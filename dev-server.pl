use strict;
use warnings;

use File::Basename qw(dirname);
use Cwd qw(abs_path);
use Config::IniFiles qw( :all);

use Plack::App::CGIBin;
use Plack::Builder;

my $CGI_DIR = sprintf "%s/cgi-bin", dirname(abs_path($0));
my $app = Plack::App::CGIBin->new(
    exec_cb => sub { 1 },
    root => $CGI_DIR
)->to_app;
builder {
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(js|css|index.html)},
        root => './'
    );
    enable(
        "Plack::Middleware::Static",
        path => qr{^/(fileadmin|ocr-corrections)},
        root => './htdocs/'
    );
    mount "/cgi-bin" => $app;
};
