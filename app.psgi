use strict;
use warnings;

use File::Basename qw(dirname);
use Cwd qw(abs_path);
use Config::IniFiles qw( :all);

use Plack::App::WrapCGI;
use Plack::Builder;

my $CGI_SCRIPT = "dist/ocr-gt-tools.cgi";
print $CGI_SCRIPT;
print "\n";
my $app = Plack::App::WrapCGI->new(
    script => $CGI_SCRIPT,
    execute => 1
)->to_app;
builder {
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(fileadmin|ocr-corrections)},
        root => './example/'
    );
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(?!ocr-gt-tools.cgi).*},
        pass_through => 1,
        root => './dist'
    );
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(?!ocr-gt-tools.cgi).*},
        root => './dist'
    );
    mount "/" => $app;
};

# vim: ft=perl :
