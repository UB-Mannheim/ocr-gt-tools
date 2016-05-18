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

=head2 http500

Send a server error message

=cut

sub http500
{
    httpError(shift(), '500 Internal Server Error', @_);
}

=head2 http400

Send a client error message

=cut

sub http400
{
    httpError(shift(), '400 Method Not Allowed', @_);
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

    # All path properties can be either relative (to OCR_GT_BASEDIR, the
    # directory containing this CGI) or absolute.
    for my $pathHash ($config->{'paths'}, $config->{'template'}->{'paths'}) {
        while (my ($pathType, $path) = each %{$pathHash}) {
            if ($path !~ m,^/,) {
                $pathHash->{$pathType} = "$OCR_GT_BASEDIR/$path";
            }
        }
    }

    # Compile all 'url-pattern' as regexes
    while (my ($patName, $pat) = each %{$config->{'url-pattern'}}) {
        $config->{'url-pattern'}->{$patName} = qr/$pat/smx;
    }

    return $config;
}


=head2 parseUrl

Map a URL to local file paths.

=cut

sub parseUrl
{
    my ($url) = @_;
    my %location = ( imageUrl => $url );

    # Try to match all the 'url-pattern' 
    while (my ($patName, $pat) = each %{$config->{'url-pattern'}}) {
        if ($url =~ $pat) {
            debug("URL Pattern '$patName' matched '$url'");
            $location{ids} = {%+};
            last;
        }
    }
    # TODO handle non-match

    # Copy templates from the configuration and fill them with the ids parsed
    for my $category (keys %{ $config->{'template'} }) {
        $location{$category} = {};
        while (my ($tplName, $tpl) = each %{$config->{'template'}->{$category}}) {
            $location{$category}->{$tplName} = $tpl;

            # First replace the tokens from the URL pattern
            while (my ($key, $value) = each %{$location{'ids'}}) {
                $location{$category}->{$tplName} =~ s/<$key>/$value/g;
            }

            # Second replace the tokens from the 'defaults' config option
            while (my ($key, $value) = each %{$config->{'defaults'}}) {
                $location{$category}->{$tplName} =~ s/<$key>/$value/g;
            }
        }
    }

    debug( "Location object: %s", Dump(\%location));

    return \%location;
}


# TODO
=head2

Get page dirs

=cut

sub getPageDirs {
    my ($location) = @_;
    my $DIR;
    opendir($DIR, $location->{'paths'}->{'correction-parent-dir'});
    my @pages = grep { /^(\d{4,4})/ && -d join('/', $location->{'paths'}->{'correction-parent-dir'}, $_)} readdir ($DIR);
    $location->{'pages'} = [];
    #loop through the array printing out the filenames
    foreach my $subdir (sort {$a cmp $b} (@pages)) {
        #print $DEBUGLOG "$subdir\n";
        my $url = $location->{'imageUrl'};
        my $curPage = $location->{'ids'}->{'page'};
        $url =~ s/$curPage/$subdir/;
        push @{ $location->{'pages'} }, {
            url => $url,
            page => $subdir
        };
    }
    closedir($DIR);
    return $location;
}


=head2 ensureCorrectionDir

Create 'correction-dir' unless it exists.

=cut

sub ensureCorrectionDir
{
    my ($location) = @_;
    if (-e $location->{'paths'}->{'correction-dir'}) {
        return;
    }
    debug("mkdir '%s'", $location->{'paths'}->{'correction-dir'});
    my @okFile = make_path($location->{'paths'}->{'correction-dir'});
    if (-d $location->{'paths'}->{'correction-dir'}) {
        debug("Created directory %s", $location->{'paths'}->{'correction-dir'});
    }
}

=head2 ensureCorrection

=cut

sub ensureCorrection
{
    my ($location) = @_;

    if (-e $location->{'paths'}->{'correction-file'} ) {
        return;
    }

    # Seiten in Bildzeilen und Textzeilen aufteilen
    chdir $location->{'paths'}->{'correction-dir'};
    my $cmd_extract = join(' '
        , $config->{'paths'}->{'hocr-extract-images'}
        , ' -b'
        , $location->{'hires-dir'}
        , $location->{'hocr-file'}
        , '>/dev/null'
        , '2>/dev/null'
    );
    debug("About to execute \n'%s'\n in '%s' for '%s'", $cmd_extract, $location->{'paths'}->{'correction-dir'}, $location->{'ids'}->{'page'});
    system $cmd_extract;
    if($?) {
        warn $?;
        http500("hocr-extract-images returned non-zero exit code $?\n\n");
    }

    # ocropusGtedit sollte vom übergeordneten Verzeichnis aufgerufen werden,
    # sonst haben nachgeordnete Scripte probleme weil Verzeichnisname in correction.html
    # nicht enthalten ist Vergleiche Issue #22
    chdir $location->{'paths'}->{'correction-parent-dir'};

    # Korrigierwebseite erstellen
    system join(' '
            , $config->{'paths'}->{'ocropus-gtedit'}
            , 'html'
            , '-x xxx'
            , join('/', $location->{'ids'}->{'page'}, 'line*.png')
            , '-o'
            , join('/', $location->{'ids'}->{'page'},  $config->{'defaults'}->{'correction-filename'})
            , '>/dev/null'
            , '2>/dev/null');
    if($?) {
        http500("ocropus-gtedit returned non-zero exit code $?\n\n");
    }
}

=head2

Create a file that contains all the line comments for a page unless that file exists

=cut

sub ensureCommentsTxt
{
    my ($location) = @_;
    opendir my $dh, $location->{'paths'}->{'correction-dir'} or
        die http500("opendir '%s': %s", $location->{'paths'}->{'correction-dir'}, $!);
    my $numberOfLines = 0;
    # TODO handle deletion
    while (readdir $dh) {
        next unless m/line-\d{3}\.txt/;
        $numberOfLines += 1;
    }
    close $dh;
    if (! -e $location->{'paths'}->{'comment-file'}) {
        debug("%s has %d lines", $location->{'ids'}->{'page'}, $numberOfLines);
        my @comments;
        for (0 .. $numberOfLines) {
            push @comments, ' ';
        }
        saveComments($location->{'paths'}->{'comment-file'}, ' ', \@comments);
    }
}

=head2

Save transliterations.

=cut

sub saveTransliteration
{
    my($correctionHtml, $transliterations) = @_;
    my $temp = "$correctionHtml.new.html";
    open my $CORR_IN, "<", $correctionHtml or http500("Could not read from '%s': %s\n", $correctionHtml, $!);
    open my $CORR_OUT, ">", $temp or http500("Could not writeTo '%s': %s\n", $temp, $!);
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
    open my $COMMENTS, ">", $commentsTxt or http500("Could not write to '%s': %s\n", $commentsTxt, $!);
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
        return http400("Missing parameter 'imageUrl' \n\n");
    }
    # Create file object
    my $location = parseUrl($url);
    # getPageDirs($location);
    # Make sure the 'correction-dir' exists
    ensureCorrectionDir($location);
    # Make sure the correction HTML exists
    ensureCorrection($location);
    ensureCommentsTxt($location);
    # clean up
    unlink glob sprintf("%s/line-*", $location->{'paths'}->{'correction-dir'});
    # Send JSON response
    delete $location->{'paths'};
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
    my $location = parseUrl($imageUrl);
    saveTransliteration($location->{'paths'}->{'correction-file'}, $transliterations);
    saveComments($location->{'paths'}->{'comment-file'}, $pageComment, $lineComments);
    return httpJSON({ result => 1 });
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
    if (! $action) {
        http400("URL parameter 'action' missing.");
    }
    debug "CGI Params: %s", Dump($cgi->{param});
    if ($action eq 'create') {
        processCreateRequest();
    } elsif ($action eq 'save') {
        processSaveRequest();
    } elsif ($action eq 'history') {
        processHistoryRequest();
    } else {
        http400("URL parameter 'action' must be 'create' or 'save', not %s", $action);
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
