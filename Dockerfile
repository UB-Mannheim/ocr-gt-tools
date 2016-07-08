FROM httpd:2.4

# Install dependencies
ADD dev/debian.mk debian.mk
RUN apt-get update && apt-get install make && make -f debian.mk apt-get
# Enable CGI in Apache
# Enable .htaccess support
RUN sed -i \
    -e 's/#LoadModule cgid_module/LoadModule cgid_module/' \
    -e 's/^\s*Options.*/\0 ExecCGI/' \
    -e 's/^\s*#AddHandler cgi-script/AddHandler cgi-script/' \
    -e 's/AllowOverride None/AllowOverride All/' \
    /usr/local/apache2/conf/httpd.conf
# Set up a data volume
RUN mkdir /data && chown daemon:www-data /data && ln -s /data/fileadmin /data/ocr-corrections /usr/local/apache2/htdocs/
VOLUME ["/data"]
ADD dev/apache.mk apache.mk
# Add dist folder
ADD dist dist
# Create configuration
# RUN cat dist/ocr-gt-tools.dev.yml \
#     | sed 's,path-prefix:.*,path-prefix: "/data",' \
#     | sed 's,stderr:.*,stderr: true,' \
#     > dist/ocr-gt-tools.yml
RUN make -f apache.mk \
    SUDO_APACHE="" \
    APACHE_DIR="/usr/local/apache2/htdocs" \
    APACHE_BASEURL="ocr-gt" \
    APACHE_USER="daemon" \
    APACHE_GROUP="www-data" \
    deploy
ADD doc/ocr-gt-tools.docker.yml htdocs/ocr-gt/ocr-gt-tools.yml
