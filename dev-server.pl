use strict;
use warnings;

use File::Basename qw(dirname);
use Cwd qw(abs_path);

use Plack::App::CGIBin;
use Plack::Builder;

my $CGI_DIR = sprintf "%s/cgi-bin", dirname(abs_path($0));
my $app = Plack::App::CGIBin->new(root => $CGI_DIR)->to_app;
builder {
    mount "/cgi-bin" => $app;
};
