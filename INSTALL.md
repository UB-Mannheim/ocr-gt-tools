# Install.md

## Repository-local server

### Install dependencies

```
make deps
```

### Optionally rebuild the distribution

```
make dev-deps dist
```

If the apt-get command fails because of `npm`, you can try skipping the Debian package installation:

```
make APT_GET dev-deps
```

### Copy configuration template and edit as needed.

```
cp conf/ocr-gt-tools.ini_tmpl conf/ocr-gt-tools.ini
```

### Start server

```
make dev-server
```

Navigate to [http://localhost:9090/dist/index.html](http://localhost:9090/index.html).

Drop a file, such as [this thumbnail](http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg) onto the document.

Do some transliterating and commenting.

Click "Speichern".

Checkout the contents of [./example/ocr-corrections/](./example/ocr-corrections/).

## Developing the frontend

Install the development dependencies: The `npm` package (which pulls in nodejs) and some nodejs-based tools:

```
make dev-deps
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


