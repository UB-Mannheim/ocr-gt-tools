#!/usr/bin/perl -w
BEGIN {
    use CGI::Carp qw(carpout);

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    my $log = 'log/erzeuge_files.log';
    open( ERRORLOG, ">>$log" ) or die "Kann nicht in $log schreiben $!\n";
    carpout(*ERRORLOG);
}

use strict;
use warnings;
use JSON;
use CGI;
use File::Path;
use Config::IniFiles qw( :all);                 # wg. Ini-Files


my $iniFile = 'conf/ocr-gt-tools.ini';

my $cfg = new Config::IniFiles( -file => $iniFile );

#'/var/www/html/fileadmin/'
my $imageSourcePath = $cfg->val( 'PATH', 'images-source' );

#'/var/www/html/
my $fileSystemWebRootPath = $cfg->val( 'PATH', 'filesystem-web-root' );
#ocr-fehler
my $gtToolsData = $cfg->val( 'PATH', 'gtToolsData' );

my $hocrExtractImagesPath = $cfg->val( 'PATH', 'hocr-extract-imagesPath' );
my $ocropusGteditPath = $cfg->val( 'PATH', 'ocropus-gteditPath' );



my $lReload = 0;
my $cgi = CGI->new;

print $cgi->header( -type => 'application/json', -charset => 'utf-8');

my $url = $cgi->param('data_url');
my $hocr_file = $cgi->param('data_hocr');


# bilde lokalen Dateinamen
#                    servername        bereich
#                     $1                $2         $3                  $4
$url =~ m/http:\/\/(.*?)\/fileadmin\/([^\/]*?)\/([^\/]*?)\/thumbs\/([^\.]*?)\.jpg/;
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

# Path to source files
my $basedir = $imageSourcePath . $cSection . '/' . $cID;

#-------------------------------------------------------------------------------
# path to created files and working directory base
# shoud readable for apache!
#-------------------------------------------------------------------------------
my $basedir_tmp = $fileSystemWebRootPath . $gtToolsData . '/' . $cSection . '/' . $cID;

my $www_basedir_tmp = '/' . $gtToolsData . '/' . $cSection . '/' . $cID;

my $gtdir   = $basedir_tmp . '/gt';
my $pagedir = $gtdir . '/' . $cPage;


print ERRORLOG __LINE__ . " \$pagedir: $pagedir\n";


if (!-e $pagedir) {
    print ERRORLOG __LINE__ . "lege gleich $pagedir an\n";
    my @okFile = mkpath($pagedir,
        {
            mode => 0777,
            verbose => 0,
            owner => 'www-data',
            group => 'www-data'
        });
}

if (-e $pagedir) {
    print ERRORLOG __LINE__ . "$pagedir existiert jetzt\n";
};

my $correction_file = 'correction.html';
my $correction_file_withRemarks = 'correction_remarks.html';


print ERRORLOG __LINE__ . ": " . $pagedir . '/' . $correction_file_withRemarks . "\n";

# Wenn Datei schon existiert dann einfach anzeigen und nicht neu erzeugen
if (!-e $pagedir . '/' . $correction_file_withRemarks ) {

    $lReload = 0;

    # Seiten in Bildzeilen und Textzeilen aufteilen
    chdir $pagedir;
    open( EXTRACT, $hocrExtractImagesPath . 'hocr-extract-images -b ' . $basedir . '/max ' . $basedir . '/hocr/' . $cFile . '.hocr' . " |");
    while( <EXTRACT>) {
        print ERRORLOG $_;
    }
    close EXTRACT;

    # Korrigierwebseite erstellen
    open( GTEDIT, $ocropusGteditPath . 'ocropus-gtedit html -x xxx ' . 'line*.png -o ' . $correction_file . " |");
    while( <GTEDIT>) {
        print ERRORLOG $_;
    }
    close GTEDIT;


    open( CORR, "<$correction_file" );
    open( CORRNEU, ">$correction_file_withRemarks" );
    my $nIndex = 0;
    my $nLineIndex = 0;

    while( <CORR> ) {
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
                print CORRNEU '<div id=' . "'seitenkommentar'" . '>' . "\n";
                print CORRNEU '<span class="label">Seitenkommentar:</span>' . "\n";
                print CORRNEU '<div id=' . "'0' class='remarks editable'" .
                              ' contenteditable="true"' . '></div>' . "\n";
                #===============================================================
                # wichtig letztes schliessende div muss in eigener Zeile
                # ausgegeben werden
                #===============================================================
                print CORRNEU '</div>' . "\n";
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

        print CORRNEU $aktZeile;

    }

        close CORR;
        close CORRNEU;

    } else {
        $lReload = 1;
}



#convert data to JSON
my $op = JSON->new->utf8->pretty(1);
my $json = $op->encode({
    result => $url,
    hocr => $hocr_file,
    correction => $www_basedir_tmp . '/gt/' . $cPage . '/' . $correction_file_withRemarks,
    correction_path => $www_basedir_tmp . '/gt/' . $cPage . '/',
    image_url => $url,
    path_section => $cSection,
    path_id => $cID,
    path_page => $cPage,
    reload => $lReload
});


print ERRORLOG __LINE__ .  " JSON: " . $json . "\n";

print $json;


# Nach der Übertragung noch aufräumen, d.h. überflüssige Dateien entfernen
