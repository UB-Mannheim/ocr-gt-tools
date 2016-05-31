#!/usr/bin/perl
use strict;
use warnings;
use utf8;

my $OCR_GT_BASEDIR;
my $ERRORLOG;
my $DATE_FORMAT = "%Y-%m-%d";
my $TIME_FORMAT = "%H:%M:%S";
use Config::IniFiles qw( :all);                 # wg. Ini-Files
                                                            # will be later convertet into yaml
use Data::Dumper;
$Data::Dumper::Terse = 1;
use File::Path qw(make_path);

use Time::HiRes qw(time);
use POSIX qw(strftime);
use Getopt::Long;                               # Komandozeilenparameter abfragen
use MIME::Base64;


BEGIN {
    use File::Path qw(make_path);
    use File::Basename qw(dirname);
    use Cwd qw(abs_path);

    # Directory containing the CGI script
    $OCR_GT_BASEDIR = dirname(abs_path($0));

    #-----------------------------------------------
    # die Datei muss fuer OTHER schreibbar sein!
    #-----------------------------------------------
    use CGI::Carp qw(carpout);
    open( $ERRORLOG, ">:utf8", "$OCR_GT_BASEDIR/log/ocr-gt-migration.log" )
      or die "Cannot write to log file '$OCR_GT_BASEDIR/log/ocr-gt-migration.log': $!\n";
    carpout(*$ERRORLOG);
}

=head1 METHODS

=head2 debug

Log a message to the log file.

=cut

sub debug {
    my $msg = sprintf(shift(), @_);
    my $t = time;
    my $timestamp = strftime $TIME_FORMAT, localtime $t;
    $timestamp .= sprintf ".%03d", ($t-int($t))*1000; # without rounding
    printf $ERRORLOG "%s: %s\n", $timestamp, $msg;
}

=head2 debugStandout

Log a short message with a timestamp and lots of noise to make it stand out.

=cut

sub debugStandout {
    my $msg = sprintf(shift(), @_);
    my $asterisks = '*' x 20;
    debug("");
    debug("%s %s %s", $asterisks, $msg, $asterisks);
    debug("");
}


=head2 loadConfig

Load the configuration from the ini file

=cut

sub loadConfig {
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


=head2

Get page dirs

=cut
sub getPageDirs {
    my ($config, $location) = @_;
    my $DIR;
    opendir($DIR, $location->{pathDirGt});
    my @pages = grep { /^(\d{4,4})/ && -d "$location->{pathDirGt}/$_" } readdir ($DIR);

    #http://digi.bib.uni-mannheim.de/fileadmin/digi/
    $location->{pages} = [];

    #loop through the array printing out the filenames
    foreach my $subdir (sort {$a cmp $b} (@pages)) {
        my $path = $location->{pathDirGt} . '/' . $subdir;
        push @{ $location->{pages} }, {
            path => $path,
            page => $subdir,
            collection => $location->{collection},
            ppn => $location->{ppn}

        };
    }
    closedir($DIR);
    return $location;
}

=head2 processRequest

Start processing request

=cut
sub processRequest {
    my ($config) = @_;

    my $action = "";
    my $help    = 0;

    GetOptions("action=s" => \$action,
               "h|help|hilfe|?"  => \$help );

    print $ERRORLOG __LINE__ . " action: '" . $action . "'\n";

    if ($action eq '') {
        processCountAll($config);
    }
}

=head2 processCountAll

Collect all infomations

=cut
sub processCountAll {
    my ($config) = @_;

    my %Auswertung = ();
    my %HtmlAuswertung = ();

    my $Data = processGetCollections($config);

    #print $Data . "\n";
    foreach my $aktCollection (@{$Data->{'collections'}}) {
        # jetzt dieses Array mit hashes abarbeiten
        print $aktCollection->{'collection'} . "\n";
        print $ERRORLOG __LINE__ . ' =>Collection: ' . $aktCollection->{'collection'} . "\n";

        my $PPNs = processGetPpns($config, $aktCollection->{'collection'});

        foreach my $aktPPN (@{$PPNs->{'ppns'}}) {
            #
            print '===>PPN: ' . $aktPPN->{'ppn'} . "\n";
            print $ERRORLOG __LINE__ . ' ===>PPN: ' . $aktPPN->{'ppn'} . "\n";
            my $PAGES = processGetPages( $config, $aktCollection->{'collection'}, $aktPPN->{'ppn'});

            # jetzt sind alle Daten vorhanden
            # jetzt die anmerkungsdateien einlesen und Daten notieren
            #print $PAGES . "\n";

            foreach my $aktPage (@{$PAGES->{'pages'}}) {


                print "====>PAGE: " .$aktPage->{'page'} . "\n";
                print $ERRORLOG __LINE__ . " ====>PAGE: " . $aktPage->{'page'} . "\n";
                my $aktAnmerk = $aktPage->{'path'} . '/' . $config->{'commentsFilename'}; # 'anmerkungen.txt';
                my $correctionHtml = $aktPage->{'path'} . '/' . $config->{'correctionHtml_basename'}; # 'correction.html';


                if (-e $correctionHtml) {
                    open( my $CORRECTION, "<:utf8", $correctionHtml);
                    my $lTable = 0;
                    my $nZeile = 0;
                    my $imageName = '';
                    my $imageNumber = '';
                    my $userInput = '';
                    while (<$CORRECTION>) {
                        my $aktZeile = $_;
                        chomp $aktZeile;

                        if ($aktZeile eq '<table>') {
                            # start new iteration
                            $nZeile = 0;

                        } elsif (($aktZeile =~ m/^\<tr\>\<td(.*?)$/) and ($nZeile == 0)) {
                            #--------------------------------------------------------------------------------------------------------
                            # Dateinamen für Grafik ermitteln
                            #--------------------------------------------------------------------------------------------------------
                            $aktZeile =~ m/^\<tr\>\<td([^\>]*?)\>(?<imagename>.*?)\<\/td\>\<\/tr\>$/;
                            my $cTempName = $+{imagename};

                            #-----------------------------------------
                            # Zwei Versionen des Dateinamens
                            #-----------------------------------------
                            # Version 1 mit Unterverzeichnis
                            #-----------------------------------------
                            if ($cTempName =~ m/^(\d{4})\/line-(?<lineNumber>\d{3})\.png/) {
                                $cTempName =~ m/^(\d{4})\/line-(?<lineNumber>\d{3})\.png/;
                                $imageNumber = $+{lineNumber};
                            #-----------------------------------------
                            # Version 2 ohne Unterverzeichnis
                            #-----------------------------------------
                            } elsif ($cTempName =~ m/^line-(?<lineNumber>\d{3})\.png/) {
                                $cTempName =~ m/^line-(?<lineNumber>\d{3})\.png/;
                                $imageNumber = $+{lineNumber};
                            }
                            $imageName = 'line-0' . $imageNumber . '.png';
                            #print __LINE__ . " " . $imageName . "\n";

                            $nZeile++;

                        } elsif (($aktZeile =~ m/^<tr><td><img alt\='line' src\='data:image\/png;base64,([^']*?)'(.*?)$/) and ($nZeile == 1)) {
                            #--------------------------------------------------------------------------------------------------------
                            # die in der HTML-Datei gespeicherten Grafiken als Dateien speichern
                            #--------------------------------------------------------------------------------------------------------
                            if (!$config->{'lCreateNoFiles'}) {
                                my $imageData = $1;
                                my $decoded=MIME::Base64::decode_base64($imageData);
                                my $imageFullName = $aktPage->{'path'} . '/' . $imageName;
                                open my $fh, '>', $imageFullName or die $!;
                                binmode $fh;
                                print $fh $decoded;
                                close $fh;
                            }

                            $nZeile++;

                        } elsif (($aktZeile =~ m/^\<tr\>\<td([^\>]*?)\>(?<userinput>.*?)\<\/td\>\<\/tr\>$/) and ($nZeile == 2)) {
                            #-------------------------------------------------------------------------------------
                            # Zeile mit den Texteingaben des Benutzers speichern
                            #-------------------------------------------------------------------------------------
                            $userInput = $+{userinput};

                            $HtmlAuswertung{'ppns'}{$aktPPN->{'ppn'}}{$aktPage->{'page'}}{'ppn'} = $aktPPN->{'ppn'};
                            $HtmlAuswertung{'ppns'}{$aktPPN->{'ppn'}}{$aktPage->{'page'}}{'page'} = $aktPage->{'page'};
                            $HtmlAuswertung{'ppns'}{$aktPPN->{'ppn'}}{$aktPage->{'page'}}{'lines'}++;


                            $HtmlAuswertung{'Lines'}++;
                            if ($userInput ne '') {
                                $HtmlAuswertung{'UserInput'}++;
                                $HtmlAuswertung{'ppns'}{$aktPPN->{'ppn'}}{$aktPage->{'page'}}{'linesUserInput'}++;
                            } else {
                                $HtmlAuswertung{'UserInputEmpty'}++;
                                $HtmlAuswertung{'ppns'}{$aktPPN->{'ppn'}}{$aktPage->{'page'}}{'linesUserInputEmpty'}++;
                            }

                            if (!$config->{'lCreateNoFiles'}) {
                                my $inputFileName = $aktPage->{'path'} . '/' . 'line-0' . $imageNumber . '.txt';
                                open my $fh, '>:utf8', $inputFileName or die $!;
                                print $fh $userInput;
                                close $fh;
                            }

                            $nZeile++;
                        }
                    }
                    close $CORRECTION;
                }


                if (-e $aktAnmerk) {
                    my $aktNr = '000';
                    my $NewCommentFileName = '';
                    my $NewCommentPageFileName = '';
                    my $fh;

                    open( ANMERK, "<:utf8", $aktAnmerk);
                    while (<ANMERK>) {


                        my $aktZeile = $_;
                        $Auswertung{'Zeilen'}++;
                        chomp $aktZeile;

                        # Trennen von Nr und Inhalt
                        if ($aktZeile =~ m/^(\d{1,3}):(.*?)$/) {
                            my $nr = $1;
                            my $rest = $2;

                            # mit printf für 3 stellen sorgen
                            $aktNr = sprintf "%04d", $nr;

                            $NewCommentFileName = $aktPage->{'path'} . '/comment-' . 'line-' . $aktNr . '.txt';
                            $NewCommentPageFileName = $aktPage->{'path'} . '/comment-page.txt';
                            if (!$config->{'lCreateNoFiles'}) {
                                if ($fh) {
                                    close $fh;
                                }
                                if ($nr eq '000' || $nr eq '00' || $nr eq '0') {
                                  open $fh, '>', $NewCommentPageFileName or die $!;
                                } else {
                                  open $fh, '>', $NewCommentFileName or die $!;
                                }
                            }

                            if ($rest eq ' ' || $rest eq '') {
                                $Auswertung{'leereZeile'}++;
                            } else {
                                $Auswertung{'ZeileMitInhalt'}++;


                                #-------------------------------------------------------------------------------------
                                # Inhalt bearbeiten und korrigieren
                                #-------------------------------------------------------------------------------------
                                # Verschiedene Formen von br mit und ohne klasse
                                $rest =~ s/&lt;br class=\"\"&gt;/<br>/g;
                                $rest =~ s/<br class=\"\">/<br>/g;
                                $rest =~ s/^(.*?)<br>$/$1/g;
                                $rest =~ s/^<br>(.*?)$/$1/g;
                                $rest =~ s/<br>/\n/g;

                                # &nbsp; irgendwo im Text ersetzen
                                if ($rest =~ m/&nbsp;/m) {
                                    $rest =~ s/&nbsp;/ /gm;
                                    while ($rest =~ m/\s\s/m) {
                                        $rest =~ s/\s\s/ /gm;
                                    }
                                }

                                # Leerzeichen am Anfang
                                $rest =~ s/^\s(.*?)$/$1/gm;
                                # Leerzeichen am Ende
                                $rest =~ s/^(.*?)\s$/$1/gm;
                                # ; am Ende
                                $rest =~ s/;$//gm;


                                # Spezielle Ersetzungen
                                $rest =~ s/# text-blocked/#text-blocked/gm;
                                $rest =~ s/kursiv/#text-italic/gm;
                                $rest =~ s/Kursiv/#text-italic/gm;


                                print $nr . "\t" . $rest . "\n";
                                print $ERRORLOG __LINE__ . " " . $nr . "\t'" . $rest . "'\n";
                                if (!$config->{'lCreateNoFiles'}) {
                                    print $fh $rest . "\n";
                                }

                                if ($nr eq '000' || $nr eq '00' || $nr eq '0') {
                                    $Auswertung{'Seitenkommentare'}++;
                                }

                                # Aufteilen von mehrzeiligen Kommentaren
                                # Ein mehrzeiliger Kommentar enthält mindestens eine "\n"
                                if ($rest =~ m/\n/m) {
                                    # Zeilen zerlegen
                                    my @aLines = split("\n", $rest);
                                    foreach my $aRest (@aLines) {

                                        # Leerzeichen am Anfang
                                        $aRest =~ s/^\s(.*?)$/$1/g;
                                        # Leerzeichen am Ende
                                        $aRest =~ s/^(.*?)\s$/$1/g;
                                        # ; am Ende
                                        $aRest =~ s/^(.*?);$/$1/g;

                                        if ($aRest eq '') {
                                            $Auswertung{'leereZeile'}++;
                                        } else {
                                            $Auswertung{'varianten'}{$aRest}++;
                                        }
                                    }
                                } else {
                                    if ($rest eq '') {
                                        $Auswertung{'leereZeile'}++;
                                    } else {
                                        $Auswertung{'varianten'}{$rest}++;
                                    }
                                  }
                            }
                        } else {
                            $Auswertung{'Folgezeilen'}++;
                            if ($aktZeile eq '') {
                                $Auswertung{'leereFolgezeile'}++;
                            } else {
                                $Auswertung{'FolgezeileMitInhalt'}++;
                                print $ERRORLOG __LINE__ . " zu $aktNr \t'" . $aktZeile . "'\n";
                                if (!$config->{'lCreateNoFiles'}) {
                                    print $fh $aktZeile . "\n";
                                }
                            }
                        }
                    }
                    close ANMERK;
                    if (!$config->{'lCreateNoFiles'}) {
                        if ($fh) {
                            close $fh;
                        }
                    }
                }
            }
        }
    }

    foreach my $aktAuswertung (sort( keys(%Auswertung))) {
        print $aktAuswertung . "\t" . $Auswertung{$aktAuswertung} . "\n";
    }

    print $ERRORLOG "\n"x3 . "Auswertungen\n";
    print $ERRORLOG 'Zeilen:' . "\t" . $Auswertung{'Zeilen'} . "\n";
    print $ERRORLOG "\t" . 'Zeilen mit Inhalt:' . "\t" . $Auswertung{'ZeileMitInhalt'} . "\n";
    print $ERRORLOG "\t" . '     leere Zeilen:' . "\t" . $Auswertung{'leereZeile'} . "\n\n";
    print $ERRORLOG 'Folgezeilen:' . "\t" . $Auswertung{'Folgezeilen'} . "\n";

    print $ERRORLOG "\t" . 'Folgezeilen mit Inhalt:' . "\t" . $Auswertung{'FolgezeileMitInhalt'} . "\n";
    print $ERRORLOG "\t" . '     leere Folgezeilen:' . "\t" . $Auswertung{'leereFolgezeile'} . "\n\n";

    print $ERRORLOG 'Seitenkommentare:' . "\t" . $Auswertung{'Seitenkommentare'} . "\n";

    print $ERRORLOG 'Varianten:' . "\n";
    foreach my $aktAuswertung (sort {$Auswertung{'varianten'}{$b} <=> $Auswertung{'varianten'}{$a}||
                                     $a cmp $b}( keys (%{$Auswertung{'varianten'}}))) {
        print $aktAuswertung . "\t" . $Auswertung{'varianten'}{$aktAuswertung} . "\n";
        print $ERRORLOG "'" . $aktAuswertung . "'\t" . $Auswertung{'varianten'}{$aktAuswertung} . "\n";
    }

    print $ERRORLOG "\n"x3 . "correction User Imput\n" . "="x60 . "\n";

    print $ERRORLOG "Zeilen: " . $HtmlAuswertung{'Lines'} . "\n";
    print $ERRORLOG "\tEingaben: " . $HtmlAuswertung{'UserInput'} . "\n";
    print $ERRORLOG "\t   keine: " . $HtmlAuswertung{'UserInputEmpty'} . "\n";


    foreach my $aktPPN (sort( keys ( %{$HtmlAuswertung{'ppns'}}))) {
        print $ERRORLOG "\n" . "-"x50 . "\n" . $aktPPN . "\n" . "-"x50 . "\n";
        foreach my $aktSeite (sort( keys( %{$HtmlAuswertung{'ppns'}{$aktPPN}}))) {

            print $ERRORLOG $aktSeite . "\n" . "-"x30 . "\n";

            print $ERRORLOG "Zeilen:" . "\t" . $HtmlAuswertung{'ppns'}{$aktPPN}{$aktSeite}{'lines'} . "\n";
            if (exists($HtmlAuswertung{'ppns'}{$aktPPN}{$aktSeite}{'linesUserInput'})) {
                print $ERRORLOG "\t" . "Zeilen  mit:" . "\t" . $HtmlAuswertung{'ppns'}{$aktPPN}{$aktSeite}{'linesUserInput'} . "\n";
            } else {
                print $ERRORLOG "\t" . "Zeilen  mit:" . "\t0\n";
            }

            if (exists($HtmlAuswertung{'ppns'}{$aktPPN}{$aktSeite}{'linesUserInputEmpty'})) {
                print $ERRORLOG "\t" . "Zeilen ohne:" . "\t" . $HtmlAuswertung{'ppns'}{$aktPPN}{$aktSeite}{'linesUserInputEmpty'} . "\n";
            } else {
                print $ERRORLOG "\t" . "Zeilen ohne:" . "\t0\n";
            }
        }
    }

}


=head2 processGetCollections

Collect all infomation an level 1 (Collections / Bereiche)

=cut
sub processGetCollections {
    my ($config,$data) = @_;

    # Create locationCollection
    my $locationCollection = mapBase($config);
    $locationCollection = getCollectionDirs($config, $locationCollection);


    return($locationCollection);
}


=head2 processShowPpns

Collect all infomation an level 2 (PPNs)

=cut
sub processGetPpns {
    my ($config, $collection) = @_;

    # Create locationCollection
    my $locationCollection = mapCollection($config, $collection);
    $locationCollection = getPpnsDirs($config, $locationCollection);

    return($locationCollection);
}



=head2 processShowPpns

Collect all infomation an level 2 (PPNs)

=cut
sub processGetPages {
    my ($config,$collection, $ppn) = @_;

    # Create locationCollection
    my $locationPPN = mapPPN($config, $collection, $ppn);
    $locationPPN = getPageDirs($config, $locationPPN);


    # Send JSON response
    return($locationPPN);
}



=head2 mapPPN

Map

=cut
sub mapPPN {
    my ($config, $collection, $ppn) = @_;
    #my %location = ();
    my $location = mapCollection($config, $collection);


    $location->{ppn} = $ppn;

    $location->{pathDirGt} = join '/'
        , $config->{docRoot}
        , $config->{correctionsRoot}
        , $collection
        , $ppn
        , 'gt';

    return $location;
}


=head2 mapCollection

Map

=cut
sub mapCollection {
    my ($config, $collection) = @_;
    my $location = mapBase($config);

    $location->{collection} = $collection;

    $location->{pathCollection} = join '/'
        , $config->{docRoot}
        , $config->{correctionsRoot}
        , $collection;

    return $location;
}

=head2 mapBase

Map

=cut
sub mapBase {
    my ($config) = @_;
    my %location = ();

    $location{correctionRoot} = join '/'
        , $config->{docRoot}
        , $config->{correctionsRoot};

    return \%location;
}



=head2

Get collection dirs

=cut
sub getCollectionDirs {
    my ($config, $location) = @_;
    my $DIR;
    opendir($DIR, $location->{correctionRoot});
    my @collections = grep { /^(digi|digitest|aktienfuehrer)$/ && -d "$location->{correctionRoot}" } readdir ($DIR);
    $location->{collections} = [];
    #loop through the array printing out the dirs
    foreach my $subdir (sort {$a cmp $b} (@collections)) {
        print '=>Collection: ' . $subdir . "\n";
        my $path = $location->{correctionRoot} . '/' . $subdir;
        push @{ $location->{collections} }, {
            path => $path,
            collection => $subdir
        };
    }
    closedir($DIR);
    return $location;
}


=head2

Get collection dirs

=cut
sub getPpnsDirs {
    my ($config, $location) = @_;
    my $DIR;
    opendir($DIR, $location->{pathCollection});
    my @ppns = grep { /^([\dxX]{9,9})$/ && -d "$location->{pathCollection}" } readdir ($DIR);
    $location->{ppns} = [];
    my $collection = $location->{collection};
    #loop through the array printing out the dirs
    foreach my $subdir (sort {$a cmp $b} (@ppns)) {
        print '==>PPN: ' . $subdir . "\n";
        print $ERRORLOG  __LINE__ . ' ==>PPN: ' . $subdir . "\n";
        my $path = $location->{pathCollection} . '/' . $subdir;
        push @{ $location->{ppns} }, {
            path => $path,
            ppn => $subdir,
            collection => $collection
        };
    }
    closedir($DIR);
    return $location;
}


my $lCreateNoFiles = 0;

GetOptions( "createNoFiles|erzeugeKeineDateien" => \$lCreateNoFiles,
                 );


my $config = loadConfig();

$config->{'lCreateNoFiles'} = $lCreateNoFiles;

processRequest($config);

