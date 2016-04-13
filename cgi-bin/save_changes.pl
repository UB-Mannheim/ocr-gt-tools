#!/usr/bin/perl -w
BEGIN {
    use CGI::Carp qw(carpout);

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    my $log = 'log/save_changes.log';
    open( ERRORLOG, ">>$log" ) or die "Kann nicht in $log schreiben $!\n";
    carpout(*ERRORLOG);
}

use strict;
use warnings;
use JSON;
use CGI;
use File::Path;
use Config::IniFiles qw( :all);                 # wg. Ini-Files

my $debug = 0;


my $iniFile = 'conf/ocr-gt-tools.ini';

my $cfg = new Config::IniFiles( -file => $iniFile );

#'/var/www/html/
my $docRoot   = $cfg->val( 'PATH', 'filesystem-web-root' );
#ocr-fehler
my $gtToolsData   = $cfg->val( 'PATH', 'gtToolsData' );


my $cgi = CGI->new;

print $cgi->header( -type => 'application/json', -charset => 'utf-8');

my $cURL = $cgi->param('data_url');
my $cChanges = $cgi->param('data_changes');
my $cSection = $cgi->param('data_section');
my $cID = $cgi->param('data_id');
my $cPage = $cgi->param('data_page');

my %hSections = ( "digi" => '1' );

# prüfen ob Beginn von $cURL mit $cBaseUrl übereinstimmt
# prüfen ob $cPage zulässig ist
# prüfen ob $cID zulässig ist
# prüfen ob $cURL einem bestimmten Muster entspricht


# Bilden der absoluten Dateinamen
my $cAktPath = join '/'
    , $docRoot 
    , $gtToolsData
    , $cSection
    , $cID
    , 'gt'
    , $cPage;
my $cCorrectionFile = join '/', $cAktPath, 'correction.html';
my $cRemarkFile     = join '/', $cAktPath, 'anmerkungen.txt';

if ($debug) {
    print ERRORLOG  $cSection  . "\n";
    print ERRORLOG  $cID  . "\n";
    print ERRORLOG  $cPage  . "\n";
};

#-------------------------------------------------------------------------------
# Schreibe Datei-Version mit Anmerkungen
#-------------------------------------------------------------------------------
print ERRORLOG "="x60 . "\n";
print ERRORLOG __LINE__ . " Schreibe jetzt in \$docRoot . \$cURL" . $docRoot . $cURL . "\n";
print ERRORLOG __LINE__ . "Schreibe Datei-Version mit Anmerkungen" . "\n";
print ERRORLOG "="x60 . "\n";

my @Zeilen = split( "\n", $cChanges );

open(my $CORRREM, ">", $docRoot . $cURL);
print $CORRREM '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' . "\n";
print $CORRREM '<html>' . "\n";
print $CORRREM '<head>' . "\n";

foreach (@Zeilen) {
    my $aktZeile = $_;
    chomp $aktZeile;

    if ($aktZeile eq "") {
        next;
    }
    print $CORRREM $aktZeile . "\n";
}

print $CORRREM '</body>' . "\n";
print $CORRREM '</html>' . "\n";

close $CORRREM;
#-------------------------------------------------------------------------------
# Schreibe Datei-Version mit Anmerkungen ENDE
#-------------------------------------------------------------------------------



#-------------------------------------------------------------------------------
# Schreibe Datei-Version ohne Kommentare
#-------------------------------------------------------------------------------
print ERRORLOG "="x60 . "\n";
print ERRORLOG __LINE__ . "Schreibe jetzt in Datei-Version ohne Kommentare: \$cCorrectionFile: " . $cCorrectionFile . "\n";
print ERRORLOG "="x60 . "\n";
print ERRORLOG __LINE__ . " Schreibe jetzt in \$cCorrectionFile: " . $cCorrectionFile . "\n";

open( CORR, ">", $cCorrectionFile );

print CORR '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' . "\n";
print CORR '<html>' . "\n";
print CORR '<head>' . "\n";


my %hAnmerkung = ();
my $lPageCommentStart = 0;


foreach (@Zeilen) {

    my $aktZeile = $_;
    chomp $aktZeile;

    if ($aktZeile eq "") {
        next;
    }

if ($lPageCommentStart) {
    print ERRORLOG $aktZeile . "\n";
};

    if ($aktZeile =~ m/\<td id= \"tools-/) {
        next;
    # Zeilenkommentare extrahieren
    #                                   1                               2        3
    } elsif ($aktZeile =~ m/\<tr id=\"(.*?)\" class=\"tr_remarks\"\>([^\>]*?)\>(.*?)\<\/td\>\<\/tr\>/) {
        my $cID        = $1;
        my $cAnmerkung = $3;
        chomp $cAnmerkung;
        $cAnmerkung =~ s/\<br\>$//g;
        if ($cAnmerkung ne "") {
            $hAnmerkung{ $cID } = {"id" => $cID,
                                 "anmerkung" => $cAnmerkung
                                };
        };
        next;
    # Beginn Seitenkommentar ermitteln
    # Seitenkommentar start
    } elsif ($aktZeile =~ m/\<div id=\"seitenkommentar\"/) {
        $lPageCommentStart = 1;
        next;
    # Seitenkommentar Inhalt
    } elsif (($aktZeile =~ m/^(.*?)id=\"0\"([^\>]*?)\>(.*?)\<\/div\>$/) and $lPageCommentStart) {
        # Suche nach der id 0 Abschluss ist ein </div>
        #                     1             2         3
        if ($aktZeile =~ m/^(.*?)id=\"0\"([^\>]*?)\>(.*?)\<\/div\>$/) {
            my $cID        = 0;
            my $cAnmerkung = $3;
            chomp $cAnmerkung;
            $cAnmerkung =~ s/\<br\>$//g;

            print ERRORLOG __LINE__ . " Seitenkommentar inhalt: '" . $cAnmerkung  . "'\n" if ($debug);
            if ($cAnmerkung ne "") {
                $hAnmerkung{ $cID } = {"id" => $cID,
                                     "anmerkung" => $cAnmerkung
                                    };
            };
            next;
        };
    # Seitenkommentar ende
    } elsif (($aktZeile =~ m/^\<\/div\>$/)  and $lPageCommentStart) {

        $lPageCommentStart = 0;

    };

    if ($lPageCommentStart) {
        # sonstige Teile von Seitenkommentar
        print ERRORLOG __LINE__ . " Seitenkommentar sonstiges: " . $aktZeile . "\n" if ($debug);
        next;
    };

    print CORR $aktZeile . "\n";
};

print CORR '</body>' . "\n";
print CORR '</html>' . "\n";

close CORR;
#-------------------------------------------------------------------------------
# Schreibe Datei-Version ohne Kommentare Ende
#-------------------------------------------------------------------------------


#-------------------------------------------------------------------------------
# Schreibe Anmerkungen
#-------------------------------------------------------------------------------
print ERRORLOG __LINE__ . " Schreibe jetzt in \$cRemarkFile: " . $cRemarkFile . "\n";
open( ANM, ">", $cRemarkFile );

foreach my $akt (sort {$a <=> $b} (keys (%hAnmerkung))) {
    print ERRORLOG __LINE__ . ": '" . $akt . "' " . $hAnmerkung{ $akt }{"anmerkung"} . "\n";
    print ANM $akt . ": " . $hAnmerkung{ $akt }{"anmerkung"} . "\n";
}

close ANM;
#-------------------------------------------------------------------------------
# Schreibe Anmerkungen Ende
#-------------------------------------------------------------------------------


#-------------------------------------------------------------------------------
# Rückmeldung
#-------------------------------------------------------------------------------
#convert data to JSON
my $op = JSON->new->utf8->pretty(1);
my $json = $op->encode({
    result => 1,
    url => $cURL,
});

print $json;
# eof: save_changes.pl
# vim: sw=4 ts=4 :
