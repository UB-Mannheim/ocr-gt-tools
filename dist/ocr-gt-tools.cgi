#!/usr/bin/perl
use strict;
use warnings;
my $DEBUGLOG;
my $REQUESTLOG;
my $DATE_FORMAT = "%Y-%m-%d";
my $TIME_FORMAT = "%H:%M:%S";

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

# Directory containing the CGI script
my $OCR_GT_BASEDIR = dirname(abs_path($0));
my $cgi = CGI->new;
my $config = loadConfig();

=head1 METHODS

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
    open($REQUESTLOG, ">>", "$logdir/request.log")
        or die "Cannot write to log file '$logdir/request.log': $!\n";
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


=head2 debugStandout

Log a short message with a timestamp and lots of noise to make it stand out.

=cut

sub debugStandout
{
    my $msg = sprintf(shift(), @_);
    my $asterisks = '*' x 20;
    debug("%s %s %s", $asterisks, $msg, $asterisks);
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
    print $REQUESTLOG $json . "\n";
}


=head2 httpError

Send an HTTP error message

=cut

sub httpError
{
    my $status = shift;
    my $msg = sprintf(shift(), @_);
    print $cgi->header(-type   => 'text/plain', -status => $status);
    debugStandout("ERROR $status - $msg");
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
        debug("No match: $str =~ $pat");
    }
    httpError(400, "Could not match '$str' to any known pattern");
}


=head2 renderTemplates

Replace all variables apropriately

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
    debug( "Rendered object: %s", Dump(\%obj));
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
        return httpError(500, "'$cmd' returned non-zero exit code '$?':\n\t$stdout\n$stderr")
    } else {
        debug("Successfully run '$cmd': " . substr($stdout, 0, 100));
    }
    return $stdout;
}


=head2

Save comments.

=cut

sub saveComments
{
    my($commentsTxt, $pageComment, $lineComments) = @_;
    open my $COMMENTS, ">", $commentsTxt or httpError(500, "Could not write to '%s': %s\n", $commentsTxt, $!);
    printf $COMMENTS "000:%s\n", $pageComment;
    my $i = 0;
    for (@{$lineComments}) {
        printf $COMMENTS "%03d:%s\n", ($i++ +1), $_;
    }
    close $COMMENTS;
}


=head2 processCreateRequest

Create process to create the files necessary

=cut

sub processCreateRequest
{
    my $url = $cgi->param('imageUrl');
    if (! $url) {
        return httpError(400, "Missing parameter 'imageUrl' \n\n");
    }
    # Create file object
    my $location = parse($url);
    executeCommand($location->{'command'}->{'build-correction-html'});
    $location->{pages} = [
        map {parse($_)} split /\n/, executeCommand($location->{'command'}->{'find-corrections-for-work'})
    ];
    # ensureCommentsTxt($location);
    # Send JSON response
    httpJSON($location);
}


=head2 processSaveRequest

Save transcriptions and comments passed via POST params.

=cut

sub processSaveRequest
{
    my $body = JSON->new->utf8->decode($cgi->param('POSTDATA'));
    my $location = parse($body->{'url'}->{'thumb-url'});
    my %saveMap = (
        'line-transcriptions' => 'line-%03d.txt',
        'line-comments'       => 'comment-line-%03d.txt',
    );
    # Save line coments and transcriptions
    for (my $i = 0; $i < scalar @{ $body->{'line-comments'}}; $i++) {
        while (my ($key, $fname_pat) = each(%saveMap)) {
            my $fname = join('/', $config->{'path'}->{'correction-dir'}, sprintf($fname_pat, $i));
            open my $fh, ">", $fname or httpError(500, "Could not write to '%s': %s\n", $fname, $!);
            print $fh $body->{$key}->[$i];
            close $fh;
        }
    }
    # Save page comment
    my $pageCommentFile = join('/', $config->{'path'}->{'correction-dir'}, 'comment-page.txt');
    print $fh $body->{'page-comment'};
    close $fh;
    print $cgi->header(-type   => 'text/plain', -status => 200);
}

=head2 processListRequest


=cut

sub processListRequest
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
    my $ret = executeCommand($cmd);
    my @locations = map { parse($_) } split(/\n/, $ret);
    return httpJSON(\@locations);
}


=head2 processHistoryRequest

Send the request log for the calling IP address.

=cut

sub processHistoryRequest
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
    print "[";
    print join(',', reverse @lines);
    print "]";
}


=head2 processRequest

Start processing CGI request

=cut

sub processRequest
{
    my $action = $cgi->url_param('action');
    debug "CGI Params: %s", Dump($cgi->{param});
    if (! $action) {
        return httpError(400, "URL parameter 'action' missing.");
    }
    if ($action eq 'create') {
        processCreateRequest();
    } elsif ($action eq 'save') {
        processSaveRequest();
    } elsif ($action eq 'list') {
        processListRequest();
    } elsif ($action eq 'history') {
        processHistoryRequest();
    } else {
        httpError(400, "URL parameter 'action' must be 'create', 'save', 'list' or 'history'. Not %s", $action);
    }
}


#
# MAIN
#
setupLogging();
debugStandout('START REQUEST');
processRequest();
logRequest();
debugStandout('END REQUEST');

# vim: sw=4 ts=4 :
