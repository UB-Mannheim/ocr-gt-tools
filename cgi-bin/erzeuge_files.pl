#!/usr/bin/perl
use strict;
use warnings;
our $ERRORLOG;
our $OCR_GT_BASEDIR;
our $cgi;
our $lReload = 0;

BEGIN {
    use CGI::Carp qw(carpout);
    use File::Path qw(make_path);
    use File::Basename qw(dirname);
    use Cwd qw(abs_path);

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    my $SCRIPT_PARENT_DIR = dirname(dirname(abs_path($0)));
    $OCR_GT_BASEDIR = $ENV{OCR_GT_BASEDIR} // $SCRIPT_PARENT_DIR;
    my $log = "$OCR_GT_BASEDIR/log/erzeuge_files.log";
    open( $ERRORLOG, ">>", $log ) or die "Cannot write to log file '$log': $!\n";
    carpout(*$ERRORLOG);
}

use Data::Dumper;
use JSON;
use CGI;
use File::Path qw(make_path);
use Config::IniFiles qw( :all);                 # wg. Ini-Files
my $correction_file = 'correction.html';
my $correction_file_withRemarks = 'correction_remarks.html';

$cgi = CGI->new;

=head1 METHODS

=head2 httpError

Send an HTTP error message

=cut
sub httpError {
    my $status = shift;
    print $ERRORLOG sprintf(@_);
    print $cgi->header(
        -type   => 'text/plain',
        -status => $status
    );
    printf @_;
    close $ERRORLOG;
    exit 1;
}

=head2 http500

Send a server error message

=cut
sub http500 { httpError('500 Internal Server Error', @_); }

=head2 http400

Send a client error message

=cut
sub http400 { httpError('400 Method Not Allowed', @_); }

=head2 httpJSON

convert data to JSON and send it

=cut
sub httpJSON
{
    my ($file) =  @_;
    my $op = JSON->new->utf8->pretty(1);
    my $json = $op->encode({
        result => $file->{url},
        correction => $file->{correction_file_withRemarks},
        correctionPath => $file->{correctionPath},
        imageUrl => $file->{url},
        pathSection => $file->{cSection},
        pathId => $file->{cID},
        pathPage => $file->{cPage},
        reload => $lReload
    });


    print $ERRORLOG __LINE__ .  " JSON: " . $json . "\n";

    print $cgi->header( -type => 'application/json', -charset => 'utf-8');
    print $json;
}

=head2 ensureCorrectionWithComments

Add HTML for commenting line input.

=cut
sub ensureCorrectionWithComments
{
    my ($correction_file, $correction_file_withRemarks) = @_;

    open( my $CORR, "<", $correction_file)or do {
        http500("Could not read from '$correction_file' $!\n\n");
    };
    open( my $CORRNEU, ">", $correction_file_withRemarks )or do {
        http500("Could not write to '$correction_file_withRemarks' $!\n\n");
    };
    my $nIndex = 0;
    my $nLineIndex = 0;

    while( <$CORR> ) {
        #-------------------------------------------
        # Anpassungen an der Datei vornehmen
        #-------------------------------------------
        my $aktZeile = $_;

        if ($aktZeile =~ /\<table\>/) {
            $nIndex = 0;
            #-------------------------------------------------------------------
            # Seitenkommentar einfügen => Index 0
            #-------------------------------------------------------------------
            if ($nLineIndex == 0) {
                print $CORRNEU '<div id=' . "'seitenkommentar'" . '>' . "\n";
                print $CORRNEU '<span class="label">Seitenkommentar:</span>' . "\n";
                print $CORRNEU '<div id=' . "'0' class='remarks editable'" .
                              ' contenteditable="true"' . '></div>' . "\n";
                #===============================================================
                # wichtig letztes schliessende div muss in eigener Zeile
                # ausgegeben werden
                #===============================================================
                print $CORRNEU '</div>' . "\n";
            }
        } elsif (($aktZeile =~ /\<tr\>/) and ($nIndex < 2)) {
            $nIndex++;
        } elsif (($aktZeile =~ /\<tr\>/) and ($nIndex == 2)) {
            $nLineIndex++;

            $aktZeile =~ /^(.*?)\<\/td\>\<\/tr\>/;
            $aktZeile = $1 . '</td>' . "\n";
            $aktZeile .= '<td  id="tools-' . $nLineIndex . '" class"td_remarks_icon" onclick="showRemark(' . $nLineIndex . ')">';
            $aktZeile .= '<span class="span-commenting-o"><i class="fa fa-commenting-o"></i></span>';
            $aktZeile .= '<span class="span-commenting hidden"><i class="fa fa-commenting hidden"></i></span>';
            $aktZeile .= '<span class="span-map-o hidden"><i class="fa fa-map-o hidden"></i></span>';
            $aktZeile .= '</td></tr>' . "\n";
            $aktZeile .= '<tr id="' . $nLineIndex . '" class="hidden tr_remarks"><td id="LineIndex_' . $nLineIndex . '" class="remarks editable" contenteditable="true" spellcheck="true"></td></tr>' . "\n";
        }

        print $CORRNEU $aktZeile;
    }

    close $CORR;
    close $CORRNEU;
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
    # Except 'gtToolsData' which is just a path segment of a URL, not a file path
    #
    for my $pathProperty ('images-source', 'filesystem-web-root', 'hocr-extract-imagesPath', 'ocropus-gteditPath') {
        unless ($cfg->val('PATH', $pathProperty) =~ m,^/,mx) {
            $cfg->setval('PATH', $pathProperty, $OCR_GT_BASEDIR . '/' . $cfg->val('PATH', $pathProperty));
        }
    }

    my $config = {
        #'/var/www/html/fileadmin/'
        imageSourcePath             => $cfg->val('PATH', 'images-source'),
        #'/var/www/html/
        fileSystemWebRootPath       => $cfg->val('PATH', 'filesystem-web-root'),
        hocrExtractImagesBinary     => $cfg->val('PATH', 'hocr-extract-imagesPath') . '/hocr-extract-images',
        ocropusGteditBinary         => $cfg->val('PATH', 'ocropus-gteditPath' ). '/ocropus-gtedit',
        #ocr-fehler
        gtToolsData                 => $cfg->val('PATH', 'gtToolsData'),
        pagedir_owner               => $cfg->val('MISC', 'pagedir-owner'),
        pagedir_group               => $cfg->val('MISC', 'pagedir-group'),
        correction_file             => $cfg->val('TEMPLATE', 'correction-filename'),
        correction_file_withRemarks => $cfg->val('TEMPLATE', 'correction-with-comments-filename'),
    };

    print $ERRORLOG sprintf "Config loaded: %s", Dumper($config);

    return $config;
}

sub mapUrltoFile
{
    my ($config, $url) = @_;
    # bilde lokalen Dateinamen
    # http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg
    #                    servername        bereich
    #                     $1                $2         $3                  $4
    my %file = (
        url => $url
    );
    @file{'cServer', 'cSection', 'cID', 'cFile'} = $url =~ m,
        https?://
        (.*?)               # cServer
        /
        fileadmin           # '/fileadmin/'
        /
        ([^/]*?)            # cSection (e.g. 'digi')
        /
        ([^/]*?)            # cID (e.g. '445442158')
        /
        thumbs              # 'thumbs'
        /
        ([^\.]*?)           # cFile (e.g. '445442158_0126') -> '0126'
        \.jpg
        ,mx;
    unless ($file{cServer} && $file{cSection} && $file{cID} && $file{cFile}) {
        http400("Cannot map URL to filesystem: $url");
    }
    $file{cFile} =~ m/.*?\_([0-9]{4})/;
    $file{cPage} = $1;
    unless ($file{cPage}) {
        http400("Cannot map URL to filesystem: $url");
    }

    print $ERRORLOG sprintf "Parsed URL as %s\n", Dumper(\%file);

    # Path to source files
    $file{basedir} = join '/'
        , $config->{imageSourcePath}
        , $file{cSection}
        , $file{cID};

    #-------------------------------------------------------------------------------
    # path to created files and working directory base
    # should be readable for apache!
    #-------------------------------------------------------------------------------
    $file{pagedir} = join '/'
      , $config->{fileSystemWebRootPath}
      , $config->{gtToolsData}
      , $file{cSection}
      , $file{cID}
      , 'gt'
      , $file{cPage};
    $file{www_basedir_tmp} = join '/'
        , $config->{gtToolsData}
        , $file{cSection}
        , $file{cID};
    $file{correction_file_withRemarks} = join('/'
        , $file{www_basedir_tmp}
        , 'gt'
        , $file{cPage}
        , $correction_file_withRemarks);
    $file{correctionPath} = join '/'
        , $file{www_basedir_tmp} 
        , 'gt'
        , $file{cPage}
        . '/';
    $file{hocr_file} = join '/'
        , $file{basedir}
        , 'max'
        , $file{cFile}
        , 'hocr'
        , $file{cFile} . '.hocr';

    print $ERRORLOG sprintf "%s: File object: %s\n", __LINE__, Dumper(\%file);

    return \%file;
}

=head2 ensurePageDir

Create 'pagedir' unless it exists.

=cut

sub ensurePageDir
{
    my ($config, $file) = @_;
    if (-e $file->{pagedir}) {
        return;
    }
    print $ERRORLOG __LINE__ . ': about to create ' . $file->{pagedir} . "\n";
    my $mkdirSpec =  {
        mode => oct(777),
        verbose => 0,
    };
    if ($config->{pagedir_owner}) {
        $mkdirSpec->{owner} = $config->{pagedir_owner};
    }
    if ($config->{pagedir_group}) {
        $mkdirSpec->{group} = $config->{pagedir_group};
    }
    my @okFile = make_path($file->{pagedir}, $mkdirSpec);
    if (-e $file->{pagedir}) {
        print $ERRORLOG "Created directory '$file->{pagedir}'\n";
    }
}

=head2 ensureCorrection

=cut
sub ensureCorrection
{
    my ($config, $file) = @_;

    # Wenn Datei schon existiert dann einfach anzeigen und nicht neu erzeugen
    if (-e $file->{pagedir} . '/' . $correction_file_withRemarks ) {
        $lReload = 1;
        return;
    }

    # TODO get rid of the chdir
    # Seiten in Bildzeilen und Textzeilen aufteilen
    chdir $file->{pagedir};
    my $cmd_extract = join(' '
        , $config->{hocrExtractImagesBinary} 
        , ' -b'
        , $file->{hocr_file}
    );
    print $ERRORLOG sprintf "About to execute '%s' in '%s'\n", $cmd_extract, $file->{pagedir};
    open my $EXTRACT, "-|", $cmd_extract or do { http500("Could not run hocr-extract-images: $!\n\n"); };
    while( <$EXTRACT>) {
        print $ERRORLOG $_;
    }
    close $EXTRACT;

    # Korrigierwebseite erstellen
    open my $GTEDIT, "-|", join(' '
            , $config->{ocropusGteditBinary}
            , '-x xxx'
            , 'line*.png'
            , '-o'
            , $config->{correction_file})
            or do { http500("Could not run ocropus-gtedit: $!\n\n"); };
    while( <$GTEDIT>) {
        print $ERRORLOG $_;
    }
    close $GTEDIT;

    print $ERRORLOG __LINE__ . ": " . $file->{pagedir} . '/' . $correction_file_withRemarks . "\n";
}


=head2 processRequest

Start processing CGI request

=cut
sub processRequest
{
    my ($config) = @_;
    my $url = $cgi->param('data_url');
    # my $hocr_file = $cgi->param('data_hocr');
    my @missing;
    push @missing, 'data_url' unless ($url);
    # push @missing, 'data_hocr' unless ($hocr_file);
    if (scalar @missing) {
        http400("Missing params: %s\n\n", join(', ', @missing));
    }
    # Create file object
    return mapUrltoFile($config, $url);
}

my $config = loadConfig();
my $file = processRequest($config);
# Make sure the pagedir exists
ensurePageDir($config, $file);
# Make sure the correction HTML exists
ensureCorrection($config, $file);
# Make sure the correction HTML with comment fields
ensureCorrectionWithComments($correction_file, $correction_file_withRemarks);
httpJSON($file);

# Nach der Übertragung noch aufräumen, d.h. überflüssige Dateien entfernen
