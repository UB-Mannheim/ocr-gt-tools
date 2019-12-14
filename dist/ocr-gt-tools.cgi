#!/usr/bin/perl
use strict;
use warnings;
use CGI;
use CGI::Carp qw(carpout);
use Cwd qw(abs_path);
use Hash::Merge;
use File::Basename qw(dirname);
use File::Path qw(make_path);
use IPC::Run qw(run);
use JSON;
use POSIX qw(strftime);
use Time::HiRes qw(time);
use YAML::XS qw(LoadFile Dump);
use open ":encoding(utf8)";

my $DEBUGLOG;
my $DATE_FORMAT = "%Y-%m-%d";
my $TIME_FORMAT = "%H:%M:%S";

# Directory containing the CGI script
my $OCR_GT_BASEDIR = dirname(abs_path($0));
my $cgi = CGI->new;
my $config = loadConfig();

=head2 setupLogging

Setup logging

=cut

sub setupLogging
{
    my $logdir = $config->{'logging'}->{'logdir'};
    if (! -d "$logdir") {
        make_path "$logdir", {mode => oct(777)};
    }
    if ($config->{'logging'}->{'stderr'}) {
        $DEBUGLOG = *STDERR;
    } else {
        open($DEBUGLOG, ">>", "$logdir/ocr-gt-tools.log")
            or die "Cannot write to log file '$logdir/ocr-gt-tools.log': $!\n";
    }
    carpout(*$DEBUGLOG);
}

=head2 debug

Log a message to the log file.

=cut

sub debug
{
    my $msg = sprintf(shift(), @_);
    my $t = time;
    my $timestamp = strftime $TIME_FORMAT, localtime $t;
    $timestamp .= sprintf ".%03d", ($t-int($t))*1000; # without rounding
    printf $DEBUGLOG "%s: %s\n", $timestamp, $msg;
}


=head2 slurp

Read file contents into a string.

=cut

sub slurp
{
    my ($fname) = @_;
    my $out = '';
    open my $fh, "<:encoding(UTF-8)", $fname or httpError(500, "Could not read file %s: $!", $fname);
    $out .= $_ while(<$fh>);
    close $fh;
    chomp $out;
    return $out;
}

=head2 logRequest

Log the IP and scan URL to request.log

=cut

sub logRequest
{
    my $url = $cgi->param('imageUrl');
    if (!$url) {
        debug("No URL to log for this request");
        return;
    }
    my $action = $cgi->url_param('action');
    my $t = time;
    my $timestamp = strftime sprintf("%sT%sZ", $DATE_FORMAT, $TIME_FORMAT), localtime $t;
    my $json = JSON->new->utf8->pretty(0)->encode({
        date => $timestamp,
        action => $action,
        url => $url,
        ip => $ENV{REMOTE_ADDR}
    });
    my $logdir = $config->{'logging'}->{'logdir'};
    open(my $REQUESTLOG, ">>", "$logdir/request.log")
        or httpError(500, "Cannot write to log file '$logdir/request.log': $!\n");
    print $REQUESTLOG $json . "\n";
    close $REQUESTLOG;
}


=head2 httpError

Send an HTTP error message

=cut

sub httpError
{
    my $status = shift;
    my $msg = sprintf(shift(), @_);
    print $cgi->header(-type   => 'text/plain', -status => $status);
    debug("********* ERROR $status - $msg *********");
    print $msg;
    exit 1;
}


=head2 httpJSON

convert data to JSON and send it

=cut

sub httpJSON
{
    my ($obj, $compact) =  @_;
    if (ref $obj eq 'ARRAY') {
        $obj = [
            map { delete $_->{'path'}; delete $_->{'command'}; $_; }
            @{ $obj }
        ];
    } elsif (ref $obj) {
        delete $obj->{'path'}; delete $obj->{'command'}
    }
    my $json = JSON->new->utf8->pretty(1)->encode($obj);
    print $cgi->header( -type => 'application/json', -charset => 'utf-8');
    print $json;
}


=head2 loadConfig

Load the configuration from the YAML file

=cut

sub loadConfig
{
    my $ymlFile = "$OCR_GT_BASEDIR/ocr-gt-tools.default.yml";
    my $config = LoadFile($ymlFile);

    # Merge with non-default config
    if (-e "$OCR_GT_BASEDIR/ocr-gt-tools.yml") {
        my $merge = Hash::Merge->new('RIGHT_PRECEDENT');
        $config = $merge->merge($config, LoadFile("$OCR_GT_BASEDIR/ocr-gt-tools.yml"));
    }

    # Compile all 'pattern' as regexes
    for (my $i = 0; $i < scalar @{$config->{'pattern'}}; $i++) {
        my $pat = $config->{'pattern'}->[$i];
        $config->{'pattern'}->[$i] = qr/$pat/smx;
    }

    # Remove all newlines from 'template'
    for my $category (keys %{$config->{'template'}}) {
        while (my ($k, $v) = each %{$config->{'template'}->{$category}}) {
            $v =~ s/\n//g;
            $config->{'template'}->{$category}->{$k} = $v;
        }
    }
    
    # Replace <OCR_GT_BASEDIR> in logging->logdir
    $config->{'logging'}->{'logdir'} =~ s/<OCR_GT_BASEDIR>/$OCR_GT_BASEDIR/g;

    return $config;
}



=head2 parse

Map a URL/path to a location

=cut

sub parse
{
    my ($str) = @_;

    # Try to match all the 'pattern'
    for (my $i = 0; $i < scalar @{$config->{'pattern'}}; $i++) {
        my $pat = $config->{'pattern'}->[$i];
        if ($str =~ $pat) {
            debug("Pattern # $i matched '$str'");
            return {
                ids => {%+},
                renderTemplates(%+),
            }
        }
        # debug("No match: $str =~ $pat");
    }
    httpError(400, "Could not match '$str' to any known pattern");
}


=head2 renderTemplates

Replace all variables appropriately

=cut

sub renderTemplates
{
    my  %tokens = (%{ $config->{'defaults'} }, @_);
    my %obj;

    # Copy templates from the configuration and fill them with the tokens parsed
    for my $category ('url', 'path', 'command') {
        $obj{$category} = {};
        while (my ($tplName, $tpl) = each %{$config->{'template'}->{$category}}) {

            # Initially set to the template string
            $obj{$category}->{$tplName} = $tpl;

            # First replace the tokens from the pattern
            while (my ($key, $value) = each %tokens) {
                if (ref $obj{$category}->{$tplName} eq 'ARRAY') {
                    $obj{$category}->{$tplName} = [
                        map {
                            my $foo = $_;
                            $foo =~ s/<$key>/$value/g;
                            $foo =~ s/<OCR_GT_BASEDIR>/$OCR_GT_BASEDIR/g;
                            $foo;
                        } @{ $obj{$category}->{$tplName} }
                    ];
                } else {
                    $obj{$category}->{$tplName} =~ s/<$key>/$value/g;
                    $obj{$category}->{$tplName} =~ s/<OCR_GT_BASEDIR>/$OCR_GT_BASEDIR/g;
                }
            }

            # Add this to the list of expanded tokens
            unless (ref $obj{$category}->{$tplName}) {
                $tokens{$tplName} = $obj{$category}->{$tplName};
            }
        }
    }
    # debug( "Rendered object: %s", Dump(\%obj));
    return %obj;
}


=head2 executeCommand

Execute one of the location's commands.

=cut

sub executeCommand
{
    my ($cmd) = @_;
    # Seiten in Bildzeilen und Textzeilen aufteilen
    debug("About to execute '%s'", join(' ', @{$cmd}));
    run $cmd, '>', \my $stdout, '2>', \my $stderr;
    debug($stdout);
    debug($stderr);
    if($?) {
        return httpError(500, "'%s' returned non-zero exit code '$?':\n\t%s\n%s", join(' ', @{$cmd}), $stdout, $stderr);
    } else {
        debug("Successfully run '%s': %s" , join(' ', @{$cmd}), substr($stdout, 0, 100));
    }
    return split /\n/, $stdout;
}


=head2 handleGet

Get process to create the files necessary

=cut

sub handleGet
{
    my $url = $cgi->param('imageUrl');
    if (! $url) {
        return httpError(400, "Missing parameter 'imageUrl' \n\n");
    }
    # Get file object
    my $location = parse($url);
    if (! -e $location->{'path'}->{'correction-dir'}) {
        executeCommand($location->{'command'}->{'extract-images'});
        $location->{'page-comment'} = '';
        for ('line-comments', 'line-transcriptions', 'line-images') {
            $location->{$_} = [];
        }
    }
    chdir $location->{'path'}->{'correction-dir'};
    for my $fname (glob 'line-*.*') {
        my $idx = int(substr($fname, 5, 4));
        debug($idx);
        if ($fname =~ /txt$/) {
            $location->{'line-transcriptions'}->[$idx-1] = slurp($fname);
        } else {
            $location->{'line-images'}->[$idx-1] = sprintf($location->{'url'}->{'line-image-url'}, $idx);
        }
    }
    for my $fname (glob 'line-*.txt') {
        $location->{'line-transcriptions'}->[-1+substr($fname, 5, 4)] = slurp($fname);
    }
    for my $fname (glob 'comment-line-*.txt') {
        $location->{'line-comments'}->[-1+substr($fname, 13, 4)] = slurp($fname);
    }
    $location->{'page-comment'} = slurp('comment-page.txt');
    $location->{'pages'} = [ map {parse($_)} executeCommand($location->{'command'}->{'find-corrections-for-work'}) ];
    # Send JSON response
    httpJSON($location);
}


=head2 handleSave

Save transcriptions and comments passed via POST params.

=cut

sub handleSave
{
    my $postdata = $cgi->param('POSTDATA');
    my $body = JSON->new->utf8->decode($postdata) or httpError(400, "Could not parse POST body");
    my $location = parse($body->{'url'}->{'thumb-url'});
    # Save line comments and transcriptions
    for (my $i = 0; $i < scalar @{ $body->{'line-comments'}}; $i++) {
        my %saveMap = (
            'line-transcriptions' , 'line-%04d.txt',
            'line-comments'       , 'comment-line-%04d.txt',
        );
        while (my ($key, $fname_pat) = each(%saveMap)) {
            my $fname = join('/', $location->{'path'}->{'correction-dir'}, sprintf($fname_pat, $i+1));
            # debug ("WRITE: $fname");
            open my $fh, ">", $fname or httpError(500, "Could not write to '%s': %s\n", $fname, $!);
            print $fh $body->{$key}->[$i] . "\n";
            close $fh;
        }
    }
    # Save page comment
    my $pageCommentFile = join('/', $location->{'path'}->{'correction-dir'}, 'comment-page.txt');
    open my $fh, ">", $pageCommentFile or httpError(500, "Could not write to '%s': %s\n", $pageCommentFile, $!);
    print $fh $body->{'page-comment'} . "\n";
    close $fh;
    print $cgi->header(-type   => 'text/plain', -status => 200);
}

=head2 handleList


=cut

sub handleList
{
    my $queryName = $cgi->param('name');
    return httpError(400, "Must set parameter 'name'\n") unless $queryName;
    my $queryStr = $cgi->param('q');
    return httpError(400, "Must set parameter 'q'\n") unless $queryStr;
    my $queryLocation = parse($queryStr);
    if (!$queryLocation->{'command'}->{'find-' . $queryName}) {
        return httpError(400, "Invalid parameter 'name' %s. Must be one of [%s]",
            $queryName, join('|', 
                grep { /^find-/ } keys %{$queryLocation->{'command'}}
            ));
    }
    my $cmd = $queryLocation->{'command'}->{'find-' . $queryName};
    debug(Dump($cmd));
    my @locations = map { parse($_) } executeCommand($cmd);
    return httpJSON(\@locations);
}


=head2 handleHistory

Send the request log for the calling IP address.

=cut

sub handleHistory
{
    my $query = $cgi->param('q');
    my $mine = defined $cgi->param('mine');
    open my $RL, "<", $config->{'logging'}->{'logdir'} . '/request.log';
    my $n = 100;
    my @lines;
    my $ip = $ENV{REMOTE_ADDR};
    while (<$RL>) {
        if ($mine) {
            next unless m/.*\Q$ip\E.*/;
        }
        if ($query) {
            next unless m/.*\Q$query\E.*/;
        }
        push @lines, $_;
    }
    @lines = ($n >= @lines ? @lines : @lines[-$n .. -1]);
    print $cgi->header( -type => 'application/json', -charset => 'utf-8');
    printf("[%s]", join(',', reverse @lines));
}


setupLogging();
debug('********* START REQUEST *********');
my $action = $cgi->url_param('action');
# debug "CGI Params: %s", Dump($cgi->{param});
httpError(400, "URL parameter 'action' missing.") unless $action;
if    ( $action eq 'get'     ) { handleGet();     }
elsif ( $action eq 'save'    ) { handleSave();    }
elsif ( $action eq 'list'    ) { handleList();    }
elsif ( $action eq 'history' ) { handleHistory(); }
else { httpError(400, "URL parameter 'action' must be 'create', 'save', 'list' or 'history'. Not %s", $action); }
# TODO handle only 'save' and 'get'
logRequest();
debug('********* END REQUEST *********');

# vim: sw=4 ts=4 :
