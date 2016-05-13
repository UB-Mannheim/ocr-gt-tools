# Installation Instructions

* [Docker Quickstart](#docker-quickstart)
* [Install dependencies](#install-dependencies)
* [Create configuration](#create-configuration)
* [Deploy on a server](#deploy-on-a-server)
	* [On Apache](#on-apache)
	* [Bundled standalone server](#bundled-standalone-server)
	* [Testing the server](#testing-the-server)
* [Developing the frontend](#developing-the-frontend)
	* [Perl](#perl)
	* [Log-Files / Error-Log-Files](#log-files--error-log-files)

## Docker Quickstart

To get the tool up and running in a docker container:

```
git clone https://github.com/UB-Mannheim/ocr-gt-tools
cd ocr-gt-tools
./run-docker.sh <path-to-images> <path-to-corrections>
```

The first time you run this, it will download the [docker
image](http://dockerhub.com/kbai/ocr-gt-tools) and run an Apache server in the
container with all the configuration taken care of.

Navigate to http://localhost:8888/ocr-gt to use it.

## Install dependencies

Install Debian packagess (for other distros, YMMV).

```
make apt-get
```

Install current Git revisions of hocr-tools and ocropus:

```
make vendor
```

## Create configuration

Copy the configuration template and edit as needed:

```
cp dist/ocr-gt-tools.dev.ini dist/ocr-gt-tools.ini
```

## Deploy on a server

### On Apache

* Enable CGI on Apache

```sh
sudo a2enmod cgi
```

* Deploy to Apache document folder:

```
make deploy
```

This will recreate out-of-date files in `./dist`, create a folder
`$APACHE_BASEURL` in `$APACHE_DIR` and copy all the files from `./dist` to
`$APACHE_DIR/$APACHE_BASEURL` using `sudo` with user `$APACHE_USER`.

Deployment can be customized with three environment variables, the default is:

```
make APACHE_USER=www-default APACHE_DIR=/var/www/html APACHE_BASEURL=ocr-gt-tools deploy
```

* Make sure scripts ending in `.cgi` are executable in the
  `$APACHE_DIR/$APACHE_BASEURL` folder:

```
sudo $EDITOR /etc/apache2/sites-available/000-default.conf
#    <Directory "/var/www/html/ocr-gt-tools">
#        Options +ExecCGI
#        AddHandler cgi-script .cgi
#    </Directory>
```

* Copy the configuration:

```
sudo -u www-data cp dist/ocr-gt-tools.dev.ini $APACHE_DIR/$APACHE_BASEURL/ocr-gt-tools.ini
# "sudo $EDITOR $APACHE_DIR/$APACHE_BASEURL/ocr-gt-tools.ini" as needed
```

* Restart apache 

```
sudo systemctl restart apache2
```

The web application will be available under [http://localhost/ocr-gt-tools](http://localhost/ocr-gt-tools).

### Docker

    docker run -t -p kbai/ocr-gt-tools

The server is available on port 9090.


### Bundled standalone server

For development and quick experimentation, we ship a standalone server,
wrapping the CGI in a Plack app:

```
make dev-server
```

### Testing the server

Navigate to [http://localhost:9090/dist/index.html](http://localhost:9090/index.html).

Drop a file, such as [this thumbnail](http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg) onto the document.

Do some transliterating and commenting.

Click "Speichern".

Checkout the contents of [./example/ocr-corrections/](./example/ocr-corrections/).


## Developing the frontend

Install the development dependencies: The `npm` package (which pulls in nodejs) and some nodejs-based tools:

```
make dev-apt-get
```

Then npm to bootstrap the tools for building HTML from Jade, CSS from LESS etc.:

```
npm install
```

And finally bower to install the frontend assets:

```
bower install
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

### Perl

For local tests in Windows I use [Strawberry Perl](http://strawberryperl.com/).

The scripts used the following perl modules. You can download them from cpan.

- CGI
- CGI::Carp
- JSON
- Config::IniFiles

### Log-Files / Error-Log-Files
Infos from perlscript ocr-gt-tools.cgi are stored in log/ocr-gt-tools.log
