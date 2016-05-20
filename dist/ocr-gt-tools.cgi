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
use File::Basename qw(dirname);
use File::Path qw(make_path);
use JSON;
use POSIX qw(strftime);
use Time::HiRes qw(time);
use YAML::XS qw(LoadFile Dump);

# Directory containing the CGI script
my $OCR_GT_BASEDIR = dirname(abs_path($0));
my $REQUESTLOG_FILENAME = "$OCR_GT_BASEDIR/log/request.log";
my $cgi = CGI->new;
my $config = loadConfig();

=head1 METHODS

=head2 setupLogging

Setup logging

=cut

sub setupLogging
{

    if (! -d "$OCR_GT_BASEDIR/log") {
        make_path "$OCR_GT_BASEDIR/log", {mode => oct(777)};
    }
    open( $DEBUGLOG, ">>", "$OCR_GT_BASEDIR/log/ocr-gt-tools.log" )
        or die "Cannot write to log file '$OCR_GT_BASEDIR/log/ocr-gt-tools.log': $!\n";
    carpout(*$DEBUGLOG);
    open( $REQUESTLOG, ">>", $REQUESTLOG_FILENAME )
        or die "Cannot write to log file '$OCR_GT_BASEDIR/log/request.log': $!\n";
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
    print $cgi->header(
        -type   => 'text/plain',
        -status => $status
    );
    printf @_;
    debugStandout("REQUEST ERROR $status");
    exit 1;
}


=head2 httpJSON

convert data to JSON and send it

=cut

sub httpJSON
{
    my ($location, $compact) =  @_;
    my $json = JSON->new->utf8->pretty(1)->encode($location);
    # debug( __LINE__ . " " . "\$json", \$json );

    print $cgi->header( -type => 'application/json', -charset => 'utf-8');
    print $json;
}


=head2 loadConfig

Load the configuration from the YAML file

=cut

sub loadConfig
{
    my $ymlFile = "$OCR_GT_BASEDIR/ocr-gt-tools.yml";

    # load development config if it exists instead
    if (-e "$OCR_GT_BASEDIR/ocr-gt-tools.dev.yml") {
        $ymlFile = "$OCR_GT_BASEDIR/ocr-gt-tools.dev.yml";
    }
    my $config = LoadFile($ymlFile);

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
    my %ids = @_;

    my %obj;

    # Copy templates from the configuration and fill them with the ids parsed
    for my $category ('url', 'path', 'query', 'command') {
        $obj{$category} = {};
        while (my ($tplName, $tpl) = each %{$config->{'template'}->{$category}}) {

            # Initially set to the template string
            $obj{$category}->{$tplName} = $tpl;

            # First replace the tokens from the pattern
            while (my ($key, $value) = each %ids) {
                $obj{$category}->{$tplName} =~ s/<$key>/$value/g;
            }

            # Second replace the tokens from the 'defaults' config option
            while (my ($key, $value) = each %{$config->{'defaults'}}) {
                $obj{$category}->{$tplName} =~ s/<$key>/$value/g;
            }

            # Lastly, replace OCR_GT_BASEDIR
            $obj{$category}->{$tplName} =~ s/<OCR_GT_BASEDIR>/$OCR_GT_BASEDIR/g;

            # Add this to the list of expanded tokens
            $ids{$tplName} = $obj{$category}->{$tplName};
        }
    }

    debug( "Rendered object: %s", Dump(\%obj));

    return %obj;
}


=head2 ensureCorrectionDir

Create 'correction-dir' unless it exists.

=cut

sub ensureCorrectionDir
{
    my ($location) = @_;
    if (-e $location->{'path'}->{'correction-dir'}) {
        return;
    }
    debug("mkdir '%s'", $location->{'path'}->{'correction-dir'});
    my @okFile = make_path($location->{'path'}->{'correction-dir'});
    if (-d $location->{'path'}->{'correction-dir'}) {
        debug("Created directory %s", $location->{'path'}->{'correction-dir'});
    }
}

=head2 ensureCorrection

=cut

sub ensureCorrection
{
    my ($location) = @_;

    if (-e $location->{'path'}->{'correction-file'} ) {
        return;
    }

    # Seiten in Bildzeilen und Textzeilen aufteilen
    my $cmd_extract = $location->{'command'}->{'hocr-extract-images'};
    debug("About to execute '%s' in '%s'", $cmd_extract);
    system $cmd_extract;
    if($?) {
        return httpError(500, "hocr-extract-images returned non-zero exit code $?\n\n");
    }

    # Korrigierwebseite erstellen
    my $cmd_gtedit = $location->{'command'}->{'ocropus-gtedit'};
    debug("About to execute '%s' in '%s'", $cmd_gtedit);
    system $cmd_gtedit;
    if($?) {
        httpError(500, "ocropus-gtedit returned non-zero exit code $?\n\n");
    }
}

=head2

Create a file that contains all the line comments for a page unless that file exists

=cut

sub ensureCommentsTxt
{
    my ($location) = @_;
    opendir my $dh, $location->{'path'}->{'correction-dir'} or
        die httpError(500, "opendir '%s': %s", $location->{'path'}->{'correction-dir'}, $!);
    my $numberOfLines = 0;
    # TODO handle deletion
    while (readdir $dh) {
        next unless m/line-\d{3}\.txt/;
        $numberOfLines += 1;
    }
    close $dh;
    if (! -e $location->{'path'}->{'comment-file'}) {
        debug("%s has %d lines", $location->{'ids'}->{'page'}, $numberOfLines);
        my @comments;
        for (0 .. $numberOfLines) {
            push @comments, ' ';
        }
        saveComments($location->{'path'}->{'comment-file'}, ' ', \@comments);
    }
}

=head2

Save transliterations.

=cut

sub saveTransliteration
{
    my($correctionHtml, $transliterations) = @_;
    my $temp = "$correctionHtml.new.html";
    open my $CORR_IN, "<", $correctionHtml or httpError(500, "Could not read from '%s': %s\n", $correctionHtml, $!);
    open my $CORR_OUT, ">", $temp or httpError(500, "Could not writeTo '%s': %s\n", $temp, $!);
    my $i = 0;
    while (<$CORR_IN>) {
        if (m/(spellcheck='true'>).*?<\/td/) {
            my $transliteration = $transliterations->[ $i++ ];
            my $leftOfClosingTag = $1;
            s/\Q$&\E/$leftOfClosingTag$transliteration<\/td/;
        }
        print $CORR_OUT $_;
    }
    rename $temp, $correctionHtml;
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
    # Make sure the 'correction-dir' exists
    ensureCorrectionDir($location);
    # Make sure the correction HTML exists
    ensureCorrection($location);
    ensureCommentsTxt($location);
    # clean up
    unlink glob sprintf("%s/line-*", $location->{'path'}->{'correction-dir'});
    # Send JSON response
    delete $location->{'path'};
    httpJSON($location);
}


=head2 processSaveRequest

Save transliterations and comments passed via POST params.

=cut

sub processSaveRequest
{
    my $imageUrl = $cgi->param('imageUrl');
    my $pageComment = $cgi->param('pageComment');
    my $lineComments = [$cgi->multi_param('lineComments[]')];
    # TODO https://github.com/UB-Mannheim/ocr-gt-tools/issues/65
    my $transliterations = [$cgi->multi_param('transliterations[]')];
    my $location = pars('url', $imageUrl);
    saveTransliteration($location->{'path'}->{'correction-file'}, $transliterations);
    saveComments($location->{'path'}->{'comment-file'}, $pageComment, $lineComments);
    return httpJSON({ result => 1 });
}

=head2 processListRequest


=cut

sub processListRequest
{
    my $queryName = $cgi->param('name');
    return httpError(400, "Must set 'name'\n") unless $queryName;
    my $queryStr = $cgi->param('q');
    return httpError(400, "Must set 'q'\n") unless $queryStr;
    my $queryLocation = parse($queryStr);
    if (!$queryLocation->{'query'}->{$queryName}) {
        return httpError(400, "Invalid 'name' $queryName. Must be one of " .
            join('|', keys %{$queryLocation->{'query'}}) .  "\n");
    }
    my $cmd = ("find " . $queryLocation->{'query'}->{$queryName} . " 2>&1");
    debug($cmd);
    my $ret = qx($cmd);
    if ($?) {
        return httpError(400, $ret);
    }
    my @locations;
    for my $path (split(/\n/, $ret)) {
        push @locations, parse($path);
    }
    return httpJSON(\@locations);
}


=head2 processHistoryRequest

Send the request log for the calling IP address.

=cut

sub processHistoryRequest
{
    my $query = $cgi->param('q');
    my $mine = defined $cgi->param('mine');
    open my $RL, "<", $REQUESTLOG_FILENAME;
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
        httpError(400, "URL parameter 'action' must be 'create' or 'save', not %s", $action);
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
