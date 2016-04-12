#!/usr/bin/perl
use strict;
use warnings;
our $OCR_GT_BASEDIR;
our $config = {};
our $cgi;
BEGIN {
    use CGI::Carp qw(carpout);

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    $OCR_GT_BASEDIR = $ENV{OCR_GT_BASEDIR} // $ENV{PWD};
    my $log = "$OCR_GT_BASEDIR/log/erzeuge_files.log";
    open( ERRORLOG, ">>", $log ) or die "Cannot write to log file '$log': $!\n";
    carpout(*ERRORLOG);
}

use strict;
use warnings;
use Data::Dumper;
use JSON;
use CGI;
use File::Path qw(make_path);
use Config::IniFiles qw( :all);                 # wg. Ini-Files

$cgi = CGI->new;
my $iniFile = "$OCR_GT_BASEDIR/conf/ocr-gt-tools.ini";

my $cfg = new Config::IniFiles( -file => $iniFile );

=h2 errorHttp

Send an HTTP error message

=cut
sub errorHttp {
    my $status = shift;
    print ERRORLOG sprintf(@_);
    print $cgi->header(
        -type   => 'text/plain',
        -status => $status
    );
    printf @_;
    exit 1;
}

=h2 error500

Send a server error message

=cut
sub error500 { errorHttp('500 Internal Server Error', @_); }

=h2 error400

Send a client error message

=cut
sub error400 { errorHttp('400 Method Not Allowed', @_); }

=h2 enhanceCorrectionHtml

Add HTML for commenting line input.

=cut
sub enhanceCorrectionHtml
{
    my ($correction_file, $correction_file_withRemarks) = @_;

    open( my $CORR, "<", $correction_file)or do {
        error500("Could not read from '$correction_file' $!\n\n");
    };
    open( my $CORRNEU, ">", $correction_file_withRemarks )or do {
        error500("Could not write to '$correction_file_withRemarks' $!\n\n");
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

=h2 loadConfig

Load the configuration from the ini file

=cut
sub loadConfig
{

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
        imageSourcePath => $cfg->val( 'PATH', 'images-source' ),

        #'/var/www/html/
        fileSystemWebRootPath => $cfg->val( 'PATH', 'filesystem-web-root' ),

        hocrExtractImagesPath => $cfg->val( 'PATH', 'hocr-extract-imagesPath' ),

        ocropusGteditPath => $cfg->val( 'PATH', 'ocropus-gteditPath' ),

        #ocr-fehler
        gtToolsData => $cfg->val( 'PATH', 'gtToolsData' );
    };

    return $config;
}

sub mapUrltoFile
{
    my ($config, $url) = @_;
    # bilde lokalen Dateinamen
    # http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg
    #                    servername        bereich
    #                     $1                $2         $3                  $4
    $url =~ m,
        https?://
        (.*?)               # servername
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
    my $cSection = $2;
    my $cID = $3;
    my $cFile = $4;

    $cFile =~ m/$cID\_([0-9]{4})/;
    my $cPage = $1;

    print ERRORLOG "\$url: $url\n";
    print ERRORLOG "\$cSection: $cSection\n";
    print ERRORLOG "\$cID: $cID\n";
    print ERRORLOG "\$cFile: $cFile\n";
    print ERRORLOG "\$cPage: $cPage\n";

    my $file = {
        cSection => $cSection,
        cID => $cID,
        cFile => $cFile,
        cPage => $cPage,
    };
    # Path to source files
    $file->{basedir} = $config->{imageSourcePath} . $file->{cSection} . '/' . $file->{cID};

    #-------------------------------------------------------------------------------
    # path to created files and working directory base
    # should be readable for apache!
    #-------------------------------------------------------------------------------
    $file->{basedir_tmp} = $config->{fileSystemWebRootPath} . $config->{gtToolsData} . '/' . $file->{cSection} . '/' . $file->{cID};
    $file->{www_basedir_tmp} = '/' . $config->{gtToolsData} . '/' . $file->{cSection} . '/' . $file->{cID};
    my $file->{pagedir}   = $file->{basedir_tmp} . '/gt/' . $file->{cPage};

    print ERRORLOG __LINE__ . ' $pagedir: ' . $file->{pagedir} . "\n";

    return $file;
}
sub ensurePageDir
{
    my ($config, $file) = @_;
    if (!-e $file->{pagedir}) {
        print ERRORLOG __LINE__ . ': about to create ' . $file->{pagedir} . "\n";
        my $mkdirSpec =  {
            mode => oct(777),
            verbose => 0,
        };
        if ($cfg->val('MISC', 'owner')) {
            $mkdirSpec->{owner} = $cfg->val('MISC', 'owner');
        }
        if ($cfg->val('MISC', 'group')) {
            $mkdirSpec->{group} = $cfg->val('MISC', 'group');
        }
        my @okFile = make_path($file->{pagedir}, $mkdirSpec);
        if (-e $file->{pagedir}) {
            print ERRORLOG "Created directory '$file->{pagedir}'\n";
        }
    }
}


my $config = loadConfig();
my $lReload = 0;

#
# Start processing CGI request
#

my $url = $cgi->param('data_url');
my $hocr_file = $cgi->param('data_hocr');

my @missing;
push @missing, 'data_url' unless ($url);
push @missing, 'data_hocr' unless ($hocr_file);

if (scalar @missing) {
    error400("Missing params: %s\n\n", join(', ', @missing));
}

# Create file object
my $file = mapUrltoFile($config, $url);
# Make sure the pagedir exists
ensurePageDir($config, $file);

my $correction_file = 'correction.html';
my $correction_file_withRemarks = 'correction_remarks.html';


print ERRORLOG __LINE__ . ": " . $file->{pagedir} . '/' . $correction_file_withRemarks . "\n";

# Wenn Datei schon existiert dann einfach anzeigen und nicht neu erzeugen
if (-e $file->{pagedir} . '/' . $correction_file_withRemarks ) {

    $lReload = 1;

} else {

    $lReload = 0;

    # TODO get rid of the chdir
    # Seiten in Bildzeilen und Textzeilen aufteilen
    chdir $file->{pagedir};
    open(my $EXTRACT, "-|", $config->{hocrExtractImagesPath} . 'hocr-extract-images -b ' . $file->{basedir} . '/max ' . $file->{basedir} . '/hocr/' . $file->{cFile} . '.hocr') or do {
        error500("Could not run hocr-extract-images: $!\n\n");
    };
    while( <$EXTRACT>) {
        print ERRORLOG $_;
    }
    close $EXTRACT;

    # Korrigierwebseite erstellen
    open( my $GTEDIT, "-|", $config->{ocropusGteditPath} . 'ocropus-gtedit html -x xxx ' . 'line*.png -o ' . $correction_file)or do {
        error500("Could not run ocropus-gtedit: $!\n\n");
    };
    while( <$GTEDIT>) {
        print ERRORLOG $_;
    }
    close $GTEDIT;
    enhanceCorrectionHtml($correction_file, $correction_file_withRemarks);
}



#convert data to JSON
my $op = JSON->new->utf8->pretty(1);
my $json = $op->encode({
    result => $url,
    hocr => $hocr_file,
    correction => $file->{www_basedir_tmp} . '/gt/' . $file->{cPage} . '/' . $correction_file_withRemarks,
    correctionPath => $file->{www_basedir_tmp} . '/gt/' . $file->{cPage} . '/',
    imageUrl => $url,
    pathSection => $file->{cSection},
    pathId => $file->{cID},
    pathPage => $file->{cPage},
    reload => $lReload
});


print ERRORLOG __LINE__ .  " JSON: " . $json . "\n";

print $cgi->header( -type => 'application/json', -charset => 'utf-8');
print $json;


# Nach der Übertragung noch aufräumen, d.h. überflüssige Dateien entfernen
