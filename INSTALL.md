# Installation Instructions

## Install dependencies

```
make deps
```

This will install debian packages (`make apt-get`) and current Git revisions of hocr-tools and ocropus (`make vendor`).

To skip installing the Debian packages, skip the `apt-get` goal:

```
make vendor
```

## Copy configuration template and edit as needed

```
cp conf/ocr-gt-tools.ini_tmpl conf/ocr-gt-tools.ini
```

## Deploy on a server

### Bundled standalone server

```
make dev-server
```

### 

Navigate to [http://localhost:9090/dist/index.html](http://localhost:9090/index.html).

Drop a file, such as [this thumbnail](http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg) onto the document.

Do some transliterating and commenting.

Click "Speichern".

Checkout the contents of [./example/ocr-corrections/](./example/ocr-corrections/).

### On Apache

```sh
cd /var/www/html
# Enable CGI in Apache
sudo a2enmod cgi
# sudo $EDITOR /etc/apache2/sites-available/000-default.conf
# Make sure scripts ending in `.cgi` are executable in the directory with `ocr-gt-tools.cgi`
#    <Directory "/path-to-htdocs/ocr-gt-tools">
#        Options +ExecCGI
#        AddHandler cgi-script .cgi
#    </Directory>
# Clone the software
sudo -u www-data git clone https://github.com/UB-Mannheim/ocr-gt-tools
# Clone the related tools
make vendor
# Generate the log files
sudo -u www-data ./ocr-gt-tools.cgi
# Copy the configuration
sudo -u www-data cp conf/ocr-gt-tools.ini_tmpl conf/ocr-gt-tools.ini
# sudo $EDIT as needed!
# Restart/Reload apache
sudo systemctl restart apache2
```

## Developing the frontend

Install the development dependencies: The `npm` package (which pulls in nodejs) and some nodejs-based tools:

```
make dev-deps
```

If the apt-get command fails because of `npm`, you can try skipping the Debian package installation:

```
make APT_GET dev-deps
```

After changing CSS/Javascript, make sure to regenerate the `dist` folder:

```
make dist
```

This will 

* Download web fonts to `./dist/fonts/` and generate a matching CSS file in `./dist/css/`
* copy all CSS stylesheets to `./dist/css/` and minify them to `./dist/style.css`
* copy all JS scripts to `./dist/js/` and minify them, in the right order, to `./dist/script.js` with source map

Javascript/CSS project dependencies are managed by bower, see `bower.json`

## After download:

- Rename **conf/ocr-gt-tools.ini_tmpl** to **conf/ocr-gt-tools.ini**
  and adapt the configuration to your needs.
  See [conf/README](conf/README) for details.

### Perl

For local tests in Windows I use http://strawberryperl.com/

The scripts used the following perl modules. You can download them from cpan.

- CGI
- CGI::Carp
- JSON
- File::Path
- Config::IniFiles
- Data::Dumper;
- File::Path
- Time::HiRes
- POSIX

#### Log-Files / Error-Log-Files
Infos from perlscript ocr-gt-tools.cgi are stored in log/ocr-gt-tools.log

### Apache
- Add directory in your configuration
```
    <Directory "/path-to-htdocs/ocr-gt-tools">                        
        Options +ExecCGI
        AddHandler cgi-script .cgi
    </Directory>
```


