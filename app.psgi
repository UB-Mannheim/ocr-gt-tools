use strict;
use warnings;

use File::Basename qw(dirname);
use Cwd qw(abs_path);
use Config::IniFiles qw( :all);

use Plack::App::WrapCGI;
use Plack::Builder;

my $CGI_SCRIPT = sprintf "%s/ocr-gt-tools.cgi", dirname(abs_path($0));
print $CGI_SCRIPT;
print "\n";
my $app = Plack::App::WrapCGI->new(
    script => $CGI_SCRIPT,
    execute => 1
)->to_app;
builder {
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(dist|ocr-gt-tools.(css|js)|index.html)},
        root => './'
    );
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(fileadmin|ocr-corrections|favicon.ico)},
        root => './htdocs/'
    );
    mount "/" => $app;
};

# vim: ft=perl :
