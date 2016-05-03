#!/usr/bin/perl
use strict;
use warnings;
my $OCR_GT_BASEDIR;
my $ERRORLOG;
my $REQUESTLOG_FILENAME;
my $REQUESTLOG;
my $DATE_FORMAT = "%Y-%m-%d";
my $TIME_FORMAT = "%H:%M:%S";

use Data::Dumper;
$Data::Dumper::Terse = 1;
use JSON;
use CGI;
use File::Path qw(make_path);
use Config::IniFiles qw( :all);                 # wg. Ini-Files
use Time::HiRes qw(time);
use POSIX qw(strftime);

my $jsonEncoderPretty = JSON->new->utf8->pretty(1);
my $jsonEncoder = JSON->new->utf8->pretty(0);

BEGIN {
    use File::Path qw(make_path);
    use File::Basename qw(dirname);
    use Cwd qw(abs_path);

    # Directory containing the CGI script
    $OCR_GT_BASEDIR = dirname(abs_path($0));
    $REQUESTLOG_FILENAME = "$OCR_GT_BASEDIR/log/request.log";

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    use CGI::Carp qw(carpout);
    open( $ERRORLOG, ">>", "$OCR_GT_BASEDIR/log/ocr-gt-tools.log" )
      or die "Cannot write to log file '$OCR_GT_BASEDIR/log/ocr-gt-tools.log': $!\n";
    carpout(*$ERRORLOG);
    open( $REQUESTLOG, ">>", $REQUESTLOG_FILENAME )
      or die "Cannot write to log file '$OCR_GT_BASEDIR/log/request.log': $!\n";
}

=head1 METHODS

=head2 debug

Log a message to the log file.

=cut

sub debug
{
    my $msg = sprintf(shift(), @_);
    my $t = time;
    my $timestamp = strftime $TIME_FORMAT, localtime $t;
    $timestamp .= sprintf ".%03d", ($t-int($t))*1000; # without rounding
    printf $ERRORLOG "%s: %s\n", $timestamp, $msg;
}

=head2 logRequest

Log the IP and scan URL to request.log

=cut

sub logRequest
{
    my $cgi = shift;
    my $url = $cgi->param('imageUrl');
    if (!$url) {
        debug("No URL to log for this request");
        return;
    }
    my $action = $cgi->url_param('action');
    my $t = time;
    my $timestamp = strftime sprintf("%sT%sZ", $DATE_FORMAT, $TIME_FORMAT), localtime $t;
    my $json = $jsonEncoder->pretty(0)->encode({
        date => $timestamp,
        action => $action,
        url => $url,
        ip => $ENV{REMOTE_ADDR}
    });
    print $REQUESTLOG $json . "\n";
}

=head2 debugStandout

Log a short message with a timestamp and lots of noise to make it stand out.

=cut

sub debugStandout
{
    my $msg = sprintf(shift(), @_);
    my $asterisks = '*' x 20;
    debug("");
    debug("%s %s %s", $asterisks, $msg, $asterisks);
    debug("");
}

=head2 loadConfig

Load the configuration from the ini file

=cut

sub loadConfig
{
    my $iniFile = "$OCR_GT_BASEDIR/ocr-gt-tools.ini";

    # load development config if it exists instead
    if (-e "$OCR_GT_BASEDIR/ocr-gt-tools.dev.ini") {
        $iniFile = "$OCR_GT_BASEDIR/ocr-gt-tools.dev.ini";
    }
    my $cfg = new Config::IniFiles( -file => $iniFile );
    #
    # All PATH properties can be either relative (to OCR_GT_BASEDIR, the base of this repository) or absolute.
    #
    for my $pathProperty ('doc-root', 'hocr-extract-imagesPath', 'ocropus-gteditPath') {
        my $val = $cfg->val('PATH', $pathProperty);
        unless ($val && $val =~ m,^/,mx) {
            $cfg->setval('PATH', $pathProperty, "$OCR_GT_BASEDIR/$val");
        }
    }

    my %config = (
        #'/var/www/html
        docRoot                 => $cfg->val('PATH', 'doc-root'),
        #<docRoot>/fileadmin
        scansRoot               => $cfg->val('PATH', 'scans-root'),
        #<docRoot>/ocr-corrections
        correctionsRoot         => $cfg->val('PATH', 'corrections-root'),
        hocrExtractImagesBinary => $cfg->val('PATH', 'hocr-extract-imagesPath') . '/hocr-extract-images',
        ocropusGteditBinary     => $cfg->val('PATH', 'ocropus-gteditPath' ). '/ocropus-gtedit',
        baseUrl                 => $cfg->val('MISC', 'baseUrl'),
        correctionDir_owner     => $cfg->val('MISC', 'correctionDir-owner'),
        correctionDir_group     => $cfg->val('MISC', 'correctionDir-group'),
        commentsFilename        => $cfg->val('TEMPLATE', 'comments-filename'),
        correctionHtml_basename => $cfg->val('TEMPLATE', 'correction-filename') #,
        #correctionHtml_withRemarks_basename => $cfg->val('TEMPLATE', 'correction-with-comments-filename'),
    );


    # debug "Config loaded: %s", Dumper(\%config);

    return \%config;
}

=head2 httpError

Send an HTTP error message

=cut
sub httpError
{
    my ($cgi, $status) = (shift(), shift());
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
    my ($cgi, $location, $compact) =  @_;
    my $json = $jsonEncoder->pretty(1)->encode($location);
    # debug( __LINE__ . " " . "\$json", \$json );

    print $cgi->header( -type => 'application/json', -charset => 'utf-8');
    print $json;
}

=head2

Get page dirs

=cut
sub getPageDirs {
    my ($cgi, $location) = @_;
    my $DIR;
    opendir($DIR, $location->{correctionDirGt});
    my @pages = grep { /^(\d{4,4})/ && -d "$location->{correctionDirGt}/$_" } readdir ($DIR);
    #loop through the array printing out the filenames
    foreach my $subdir (sort {$a cmp $b} (@pages)) {
        #print $ERRORLOG "$subdir\n";
        $location->{pages} .= $subdir . '|';
    }
    closedir($DIR);
    return $location;
}


=head2

Map a URL to local file paths

=cut

sub mapUrltoFile
{
    my ($cgi, $config, $url) = @_;
    # bilde lokalen Dateinamen
    # http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg
    #                    servername        bereich
    #                     $1                $2         $3                  $4
    my %location = (
        imageUrl => $url
    );
    @location{'pathServer', 'pathSection', 'pathId', 'cFile'} = $url =~ m,
        https?://
        (.*?)               # pathServer
        /
        fileadmin           # '/fileadmin/'
        /
        ([^/]*?)            # pathSection (e.g. 'digi')
        /
        ([^/]*?)            # pathId (e.g. '445442158')
        /
        thumbs              # 'thumbs'
        /
        ([^\.]*?)           # cFile (e.g. '445442158_0126') -> '0126'
        \.jpg
        ,mx;
    unless ($location{pathServer} && $location{pathSection} && $location{pathId} && $location{cFile}) {
        http400($cgi, "Cannot map URL to filesystem: $url");
    }
    $location{hiresUrl} = $url;
    $location{hiresUrl} =~ s/thumbs/max/smx;
    $location{cFile} =~ m/.*?\_([0-9]{4})/;
    $location{pathPage} = $1;
    unless ($location{pathPage}) {
        http400($cgi, "Cannot map URL to filesystem: $url");
    }

    #-------------------------------------------------------------------------------
    # path to created files and working directory base
    # should be readable for apache!
    #-------------------------------------------------------------------------------

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/gt/0126/
    $location{correctionDir} = join '/'
        , $config->{docRoot}
        , $config->{correctionsRoot}
        , $location{pathSection}
        , $location{pathId}
        , 'gt'
        , $location{pathPage};

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/gt
    $location{correctionDirGt} = join '/'
        , $config->{docRoot}
        , $config->{correctionsRoot}
        , $location{pathSection}
        , $location{pathId}
        , 'gt';

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/gt/0126/correction.html
    $location{correctionHtml} = join '/'
        , $location{correctionDir}
        , $config->{correctionHtml_basename};

    # ex: 'ocr-corrections/digi/445442158/gt/0126/correction.html
    $location{correctionUrl} = $config->{baseUrl} .  join '/'
        , $config->{correctionsRoot}
        , $location{pathSection}
        , $location{pathId}
        , 'gt'
        , $location{pathPage},
        , $config->{correctionHtml_basename};

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/gt/0126/anmerkungen.txt
    $location{commentsTxt} = join '/'
        , $location{correctionDir}
        , $config->{commentsFilename};

    # ex: 'ocr-corrections/digi/445442158/gt/0126/anmerkungen.txt
    $location{commentsUrl} = $config->{baseUrl} .  join '/'
        , $config->{correctionsRoot}
        , $location{pathSection}
        , $location{pathId}
        , 'gt'
        , $location{pathPage},
        , $config->{commentsFilename};

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/max
    $location{imageDir} = join '/'
        , $config->{docRoot}
        , $config->{scansRoot}
        , $location{pathSection}
        , $location{pathId}
        , 'max';

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/hocr/445442158_0126.jpg
    $location{hocr_file} = join '/'
        , $config->{docRoot}
        , $config->{scansRoot}
         , $location{pathSection}
        , $location{pathId}
        , 'hocr'
        , $location{cFile} . '.hocr';

    debug( "Location object: %s", Dumper(\%location));

    return \%location;
}

=head2 ensureCorrectionDir

Create 'correctionDir' unless it exists.

=cut

sub ensureCorrectionDir
{
    my ($cgi, $config, $location) = @_;
    if (-e $location->{correctionDir}) {
        return;
    }
    debug("%s: about to create %s", __LINE__, $location->{correctionDir});
    my $mkdirSpec =  {
        mode => oct(777),
        verbose => 0,
    };
    if ($config->{correctionDir_owner}) {
        $mkdirSpec->{owner} = $config->{correctionDir_owner};
    }
    if ($config->{correctionDir_group}) {
        $mkdirSpec->{group} = $config->{correctionDir_group};
    }
    my @okFile = make_path($location->{correctionDir}, $mkdirSpec);
    if (-e $location->{correctionDir}) {
        debug("Created directory '$location->{correctionDir}'");
    }
}

=head2 ensureCorrection

=cut
sub ensureCorrection
{
    my ($cgi, $config, $location) = @_;

    if (-e $location->{correctionHtml} ) {
        $location->{reload} = 1;
        return;
    }

    # Seiten in Bildzeilen und Textzeilen aufteilen
    chdir $location->{correctionDir};
    my $cmd_extract = join(' '
        , $config->{hocrExtractImagesBinary}
        , ' -b'
        , $location->{imageDir}
        , $location->{hocr_file}
        , '>/dev/null'
        , '2>/dev/null'
    );
    debug("About to execute '%s' in '%s' for '%s'", $cmd_extract, $location->{correctionDir}, $location->{pathPage});
    system $cmd_extract;
    if($?) {
        http500($cgi, "hocr-extract-images returned non-zero exit code $?\n\n");
    }

    # ocropusGtedit sollte vom übergeordneten Verzeichnis aufgerufen werden,
    # sonst haben nachgeordnete Scripte probleme weil Verzeichnisname in correction.html
    # nicht enthalten ist Vergleiche Issue #22
    chdir $location->{correctionDirGt};

    # Korrigierwebseite erstellen
    system join(' '
            , $config->{ocropusGteditBinary}
            , 'html'
            , '-x xxx'
            , $location->{pathPage} . '/line*.png'
            , '-o'
            , $location->{pathPage} . '/' . $config->{correctionHtml_basename}
            , '>/dev/null'
            , '2>/dev/null');
    if($?) {
        http500($cgi, "ocropus-gtedit returned non-zero exit code $?\n\n");
    }

    # debug("%s: %s/%s", $location->{correctionDir},  $correctionHtml_withRemarks_basename);
}

=head2

Create a file that contains all the line comments for a page unless that file exists

=cut

sub ensureCommentsTxt
{
    my ($cgi, $config, $location) = @_;
    opendir my $dh, $location->{correctionDir} or http500($cgi, "opendir '%s': %s", $location->{correctionDir}, $!);
    $location->{numberOfLines} = 0;
    while (readdir $dh) {
        next unless m/line-\d{3}\.txt/;
        $location->{numberOfLines} += 1;
    }
    close $dh;
    # debug("%s has %d lines", $location->{pathPage}, $location->{numberOfLines});
    if (! -e $location->{commentsTxt}) {
        my @comments;
        for (0 .. $location->{numberOfLines}) {
            push @comments, ' ';
        }
        saveComments($cgi, $config, $location->{commentsTxt}, ' ', \@comments);
    }
}

=head2

Save transliterations.

=cut
sub saveTransliteration
{
    my($cgi, $config, $correctionHtml, $transliterations) = @_;
    my $temp = "$correctionHtml.new.html";
    open my $CORR_IN, "<", $correctionHtml or http500($cgi,
        sprintf( "Could not read from '%s': %s\n", $correctionHtml, $!));
    open my $CORR_OUT, ">", $temp or http500($cgi,
        sprintf( "Could not writeTo '%s': %s\n", $temp, $!));
    my $i = 0;
    while (<$CORR_IN>) {
        if (m/(spellcheck='true'>).*?<\/td/) {
            my $transliteration = $transliterations->[ $i++ ];
            my $leftOfClosingTag = $1;
            s/$&/$leftOfClosingTag$transliteration<\/td/;
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
    my($cgi, $config, $commentsTxt, $pageComment, $lineComments) = @_;
    open my $COMMENTS, ">", $commentsTxt or http500($cgi,
        sprintf( "Could not write to '%s': %s\n", $commentsTxt, $!));
    printf $COMMENTS "000:%s\n", $pageComment;
    my $i = 0;
    for (@{$lineComments}) {
        printf $COMMENTS "%03d:%s\n", ($i++ +1), $_;
    }
    close $COMMENTS;
}


=head2 processRequest

Start processing CGI request

=cut
sub processRequest
{
    my ($cgi, $config) = @_;
    my $action = $cgi->param('action');
    if (! $action) {
        http400($cgi, "URL parameter 'action' missing.");
    }
    debug "CGI Params: %s", Dumper($cgi->{param});
    if ($action eq 'create') {
        processCreateRequest($cgi, $config);
    } elsif ($action eq 'save') {
        processSaveRequest($cgi, $config);
    } elsif ($action eq 'history') {
        processHistoryRequest($cgi, $config);
    } else {
        http400($cgi, "URL parameter 'action' must be 'create' or 'save', not %s", $action);
    }
}

=head2 processCreateRequest

Create process to create the files necessary

=cut
sub processCreateRequest
{
    my ($cgi, $config) = @_;
    my $url = $cgi->param('imageUrl');
    my @missing;
    push @missing, 'imageUrl' unless ($url);
    if (scalar @missing) {
        http400($cgi, "Missing params: %s\n\n", join(', ', @missing));
    }
    # Create file object
    my $location = mapUrltoFile($cgi, $config, $url);
    getPageDirs($cgi, $location);
    # Make sure the correctionDir exists
    ensureCorrectionDir($cgi, $config, $location);
    # Make sure the correction HTML exists
    ensureCorrection($cgi, $config, $location);
    ensureCommentsTxt($cgi, $config, $location);
    # Send JSON response
    httpJSON($cgi, $location);
    # clean up
    unlink glob sprintf("%s/line-*", $location->{correctionDir});
}

=head2 processCreateRequest

Save transliterations and comments passed via POST params.

=cut
sub processSaveRequest
{
    my ($cgi, $config) = @_;
    my $imageUrl = $cgi->param('imageUrl');
    my $pageComment = $cgi->param('pageComment');
    my $lineComments = [$cgi->multi_param('lineComments[]')];
    my $transliterations = [$cgi->multi_param('transliterations[]')];
    my $location = mapUrltoFile($cgi, $config, $imageUrl);
    saveTransliteration($cgi, $config, $location->{correctionHtml}, $transliterations);
    saveComments($cgi, $config, $location->{commentsTxt}, $pageComment, $lineComments);
    return httpJSON($cgi, { result => 1 });
}

=head2 processCreateRequest

Send the request log for the calling IP address.

=cut
sub processHistoryRequest
{
    my ($cgi, $config) = @_;
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

debugStandout('START REQUEST');
my $cgi = CGI->new;
my $config = loadConfig();
if (! -d $config->{docRoot}) {
    http500($cgi, "The 'docRoot' directory doesn't exist. Please check the configuration");
}
processRequest($cgi, $config);
logRequest($cgi);
debugStandout('END REQUEST');

# vim: sw=4 ts=4 :
