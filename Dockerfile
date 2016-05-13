FROM httpd:2.4

# Install dependencies
ADD Makefile Makefile
RUN apt-get update && apt-get install make && make SUDO="" apt-get
# Set up a data volume
RUN mkdir /data && chown daemon:www-data /data && ln -s /data/fileadmin /data/ocf-corrections /usr/local/apache2/htdocs/
VOLUME ["/data"]
# Enable CGI in Apache
RUN sed -i 's/#LoadModule cgid_module/LoadModule cgid_module/' /usr/local/apache2/conf/httpd.conf
RUN sed -i 's/^\s*Options.*/\0 ExecCGI/' /usr/local/apache2/conf/httpd.conf
RUN sed -i 's/^\s*#AddHandler cgi-script/AddHandler cgi-script/' /usr/local/apache2/conf/httpd.conf
# Enable .htaccess support
RUN sed -i 's/AllowOverride None/AllowOverride All/' /usr/local/apache2/conf/httpd.conf
# Add dist folder
ADD dist dist
# Create configuration
RUN cat dist/ocr-gt-tools.dev.ini \
    | sed 's,^doc-root.*,doc-root=/data,' \
    > dist/ocr-gt-tools.ini
RUN make \
    SUDO="" \
    SUDO_APACHE="" \
    APACHE_DIR="/usr/local/apache2/htdocs/ocr-gt" \
    APACHE_USER="daemon" \
    APACHE_GROUP="www-data" \
    deploy

# Add samples
# RUN apt-get update && apt-get install -y vim
# CMD ["bash"]
