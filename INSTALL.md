# Install.md

## Repository-local server

Install dependencies

```
make deps
```

Copy configuration template:

```
cp conf/ocr-gt-tools.ini_tmpl conf/ocr-gt-tools.ini
```

Start server

```
make dev-server
```

Navigate to [http://localhost:9090/index.html](http://localhost:9090/index.html).

Drop a file, such as [this thumbnail](http://digi.bib.uni-mannheim.de/fileadmin/digi/445442158/thumbs/445442158_0126.jpg) onto the document.

Do some transliterating and commenting.

Click "Speichern".

Checkout the contents of [./htdocs/ocr-corrections/](./htdocs/ocr-corrections/).

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

#### Log-Files / Error-Log-Files
Infos from the perlscripts are stored in log/*

- xxx.pl stored in
  - xxx.log (Normal Infos and Errors)
- xxx.pl stored in
  - xxx.log (Normal Infos and Errors)

### Apache
- Add directory in your configuration
```
    <Directory "/path-to-htdocs/ocr-gt-tools">                        
        Options +ExecCGI
        AddHandler cgi-script .pl
    </Directory>
```


