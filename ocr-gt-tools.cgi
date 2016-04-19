#!/usr/bin/perl
use strict;
use warnings;
my $OCR_GT_BASEDIR;
my $ERRORLOG;
# my $DATE_FORMAT = "%Y-%m-%d %H:%M:%S";
my $DATE_FORMAT = "%H:%M:%S";

use Data::Dumper;
use JSON;
use CGI;
use File::Path qw(make_path);
use Config::IniFiles qw( :all);                 # wg. Ini-Files
use Time::HiRes qw(time);
use POSIX qw(strftime);

BEGIN {
    use File::Path qw(make_path);
    use File::Basename qw(dirname);
    use Cwd qw(abs_path);

    my $SCRIPT_PARENT_DIR = dirname(abs_path($0));
    $OCR_GT_BASEDIR = $ENV{OCR_GT_BASEDIR} // $SCRIPT_PARENT_DIR;

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    use CGI::Carp qw(carpout);
    my $log = "$OCR_GT_BASEDIR/log/ocr-gt-tools.log";
    open( $ERRORLOG, ">>", $log ) or die "Cannot write to log file '$log': $!\n";
    carpout(*$ERRORLOG);
}

=head1 METHODS

=head2 debug

Log a message to the log file.

=cut

sub debug
{
    my $msg = sprintf(shift(), @_);
    my $t = time;
    my $timestamp = strftime $DATE_FORMAT, localtime $t;
    $timestamp .= sprintf ".%03d", ($t-int($t))*1000; # without rounding
    printf $ERRORLOG "%s: %s\n", $timestamp, $msg;
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
    my $iniFile = "$OCR_GT_BASEDIR/conf/ocr-gt-tools.ini";
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
        #'/var/www/html/
        docRoot                 => $cfg->val('PATH', 'doc-root'),
        #<docRoot>/fileadmin
        scansRoot               => $cfg->val('PATH', 'scans-root'),
        #<docRoot>/ocr-corrections
        correctionsRoot         => $cfg->val('PATH', 'corrections-root'),
        hocrExtractImagesBinary => $cfg->val('PATH', 'hocr-extract-imagesPath') . '/hocr-extract-images',
        ocropusGteditBinary     => $cfg->val('PATH', 'ocropus-gteditPath' ). '/ocropus-gtedit',
        correctionDir_owner     => $cfg->val('MISC', 'correctionDir-owner'),
        correctionDir_group     => $cfg->val('MISC', 'correctionDir-group'),
        commentsFilename        => $cfg->val('TEMPLATE', 'comments-filename'),
        correctionHtml_basename => $cfg->val('TEMPLATE', 'correction-filename') #,
        #correctionHtml_withRemarks_basename => $cfg->val('TEMPLATE', 'correction-with-comments-filename'),
    );


    debug "Config loaded: %s", Dumper(\%config);

    return \%config;
}

=head2 httpError

Send an HTTP error message

=cut
sub httpError {
    my ($cgi, $status) = (shift(), shift());
    print $cgi->header(
        -type   => 'text/plain',
        -status => $status
    );
    printf @_;
    debugStandout('REQUEST ERROR');
    exit 1;
}

=head2 http500

Send a server error message

=cut
sub http500 { httpError(shift(), '500 Internal Server Error', @_); }

=head2 http400

Send a client error message

=cut
sub http400 { httpError(shift(), '400 Method Not Allowed', @_); }

=head2 httpJSON

convert data to JSON and send it

=cut
sub httpJSON
{
    my ($cgi, $location) =  @_;
    my $op = JSON->new->utf8->pretty(1);
    my $json = $op->encode($location);
    debug( __LINE__ . " " . "\$json", \$json );

    print $cgi->header( -type => 'application/json', -charset => 'utf-8');
    print $json;
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
    $location{cFile} =~ m/.*?\_([0-9]{4})/;
    $location{pathPage} = $1;
    unless ($location{pathPage}) {
        http400($cgi, "Cannot map URL to filesystem: $url");
    }

    #-------------------------------------------------------------------------------
    # path to created files and working directory base
    # should be readable for apache!
    #-------------------------------------------------------------------------------

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/gt/0126/correction.html
    $location{correctionDir} = join '/'
        , $config->{docRoot}
        , $config->{correctionsRoot}
        , $location{pathSection}
        , $location{pathId}
        , 'gt'
        , $location{pathPage};

    # ex: '/home/user/ocr-gt-tools/htdocs/ocr-corrections/digi/445442158/gt/0126/correction.html
    $location{correctionHtml} = join '/'
        , $location{correctionDir}
        , $config->{correctionHtml_basename};

    # ex: 'ocr-corrections/digi/445442158/gt/0126/correction.html
    $location{correctionUrl} = join '/'
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
    $location{commentsUrl} = join '/'
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
    );
    debug("About to execute '%s' in '%s'", $cmd_extract, $location->{correctionDir});
    open my $EXTRACT, "-|", $cmd_extract or do { http500($cgi, "Could not run hocr-extract-images: $!\n\n"); };
    while( <$EXTRACT>) {
        debug($_);
    }
    close $EXTRACT;

    # Korrigierwebseite erstellen
    open my $GTEDIT, "-|", join(' '
            , $config->{ocropusGteditBinary}
            , 'html'
            , '-x xxx'
            , 'line*.png'
            , '-o'
            , $config->{correctionHtml_basename})
            or do { http500($cgi, "Could not run ocropus-gtedit: $!\n\n"); };
    while( <$GTEDIT>) {
        debug($_);
    }
    close $GTEDIT;

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
    debug("%s has %d lines", $location->{pathPage}, $location->{numberOfLines});
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
        if (m/(spellcheck='true'>).*?</) {
            my $transliteration = $transliterations->[ $i++ ];
            my $leftOfClosingTag = $1;
            s/$&/$leftOfClosingTag$transliteration</;
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
    my $action = $cgi->url_param('action');
    debug $action . " will run", Dumper(\$cgi);
    if (! $action) {
        http400($cgi, "URL parameter 'action' missing.");
    } elsif ($action eq 'create') {
        processCreateRequest($cgi, $config);
    } elsif ($action eq 'save') {
        processSaveRequest($cgi, $config);
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
    my $url = $cgi->param('data_url');
    my @missing;
    push @missing, 'data_url' unless ($url);
    if (scalar @missing) {
        http400($cgi, "Missing params: %s\n\n", join(', ', @missing));
    }
    # Create file object
    my $location = mapUrltoFile($cgi, $config, $url);
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

debugStandout('START REQUEST');
my $cgi = CGI->new;
my $config = loadConfig();
processRequest($cgi, $config);
debugStandout('END REQUEST');

# vim: sw=4 ts=4 :
