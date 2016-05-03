# Port of the dev server
PORT = 9090
APACHE_USER = www-data
APACHE_DIR = /var/www/html
APACHE_BASEURL = ocr-gt-tools

# Add node_modules/.bin to $PATH so the CLI tools 
# installed locally by npm can be used
export PATH := $(PWD)/node_modules/.bin:$(PATH)

#
# Define all the CLI tools to use
#

# Standard UNIX tools, recurse, create parents, force delete
MKDIR = mkdir -p
RM    = rm -rf
CP    = cp -r
# cURL to download files
CURL          = curl -s
# Git clone, by default do a shallow clone, only last commit
GIT_CLONE     = git clone --depth 1
# Install debian packages, non-interactively
APT_GET_OPTS  = -y
APT_GET       = sudo apt-get $(APT_GET_OPTS)
# NPM is NodeJS' package manager
NPM_OPTS      =
NPM           = npm $(NPM_OPTS)
# "Plackup is a command line utility to run PSGI applications from the command line"
# https://en.wikipedia.org/wiki/Plack_(software)
PLACKUP_OPTS  = --port $(PORT) -R
PLACKUP       = plackup $(PLACKUP_OPTS)
# Bower is a front-end asset manager with packages of JS/CSS for many well-known projects
BOWER         = bower
# clean-css is a CSS minifier and optimizer
CLEANCSS      = cleancss
# UglifyJS minifies, merges and optimizes Javascript
UGLIFYJS      = uglifyjs
# webfont-dl is a tool to download web fonts from the Google Fonts API
WEBFONTDL_OPTS = --eot=omit
WEBFONTDL     = webfont-dl $(WEBFONTDL_OPTS)
# Jade is a templating engine
JADE_OPTS     = --pretty
JADE          = jade $(JADE_OPTS)
# Stylus is a CSS compiler
#
STYLUS  = stylus
# Chokidar is a file system change watcher (think: inotify)
# https://github.com/kimmobrunfeldt/chokidar-cli
CHOKIDAR_OPTS = --verbose --polling --initial --debounce 100
CHOKIDAR      = chokidar $(CHOKIDAR_OPTS)

#
# Define lists of assets
#

# Debian packages required for running the backend
DEBIAN_PACKAGES = \
	git \
	libjson-perl \
	libconfig-inifiles-perl \
	python-numpy \
	python-scipy \
	python-matplotlib
# Debian packages required for running the dev-server and rebuild the frontend
DEV_DEBIAN_PACKAGES = \
	npm \
	nodejs-legacy \
	libplack-perl \
	curl
# URLs of Web Fonts to embed
FONT_URLS = https://fonts.googleapis.com/css?family=EB+Garamond&subset=latin,latin-ext
# Font files (eot, ttf, woff...) to bundle
FONT_FILES = bower_components/font-awesome/fonts/fontawesome-webfont.* \
             bower_components/bootstrap/fonts/glyphicons-halflings-regular.*
# URLs of CSS to download
CSS_URLS = https://getbootstrap.com/examples/dashboard/dashboard.css
# CSS files to bundle into one minified `dist/vendor.css`
# NOTE: Our CSS should not be bundled here
CSS_FILES   = bower_components/reset-css/reset.css \
              bower_components/bootstrap/dist/css/bootstrap.css \
              bower_components/font-awesome/css/font-awesome.css
# JS scripts to bundle into one minified `dist/vendor.js`
# NOTE: Javascript developed by us should not be bundled here
JS_FILES    = bower_components/jquery/dist/jquery.js \
              bower_components/bootstrap/dist/js/bootstrap.js \
              bower_components/handlebars/handlebars.min.js \
			  bower_components/clipboard/dist/clipboard.min.js
# The HTML files, described in the Jade shorthand / templating language
JADE_FILES  = ocr-gt-tools.jade
# The files to watch for changes for to trigger a rebuild
WATCH_FILES = Makefile ocr-gt-tools.* ${JADE_FILES} *.json

#
# Define the list of targets that will "always fail", i.e. the CLI api
#
# clean-js clean-html clean-fonts clean-css \

.PHONY: debug \
        clean \
        deps apt-get \
        dev-deps dev-apt-get \
        dev-server dist-watch \
        deploy

#
# Debugging
#
print-%: ; @echo $*=$($*)

__: clean dist

_.%: ; $(MAKE) -C . clean-$* dist

debug:
	@grep '^[A-Z0-9_]\+\s*=' Makefile \
	  |grep -o '^[A-Z0-9_]*' \
	  |xargs -I{} make -s . print-{}

#
# Dependencies to execute ocropy / hocr-tools in a CGI environment
#

deps: apt-get vendor

apt-get:
	$(APT_GET) install $(DEBIAN_PACKAGES)

vendor: dist/vendor/hocr-tools dist/vendor/ocropy

dist/vendor/hocr-tools:
	$(MKDIR) dist/vendor
	$(GIT_CLONE) https://github.com/UB-Mannheim/hocr-tools $@

dist/vendor/ocropy:
	$(MKDIR) dist/vendor
	$(GIT_CLONE) https://github.com/tmbdev/ocropy $@

log/ocr-gt-tools.log:
	touch $@

log/request.log:
	touch $@

#
# Options for development
#

node_modules: package.json
	$(NPM) $(NPM_OPTS) install

bower_components: bower.json
	$(BOWER) install

dev-apt-get:
	$(APT_GET) install $(DEV_DEBIAN_PACKAGES)

dev-deps: dev-apt-get bower_components node_modules

#
# Run the development standalone server on port 9090
#

# Sanity check to prevent running without a config file
conf/ocr-gt-tools.ini:
	@echo "Copy conf/ocr-gt-tools.ini_tmpl to conf/ocr-gt-tools.ini and set paths."
	exit 1

dev-server:
	$(PLACKUP) app.psgi

dev-browser:
	xdg-open http://localhost:9090/dist/index.html


#
# Set up dist folder
#

dist: \
	vendor \
	dist/log\
	dist/vendor.css\
	dist/vendor.js\
	dist/fonts\
	dist/index.html\
	dist/ocr-gt-tools.js\
	dist/ocr-gt-tools.css\
	dist/ocr-gt-tools.cgi

dist/log:
	$(MKDIR) $@

dist/ocr-gt-tools.cgi: ocr-gt-tools.cgi
	$(CP) $< $@
	chmod a+x $@

dist/ocr-gt-tools.js: ocr-gt-tools.js
	$(UGLIFYJS) --source-map --compress --output $@ $<

dist/ocr-gt-tools.css: ocr-gt-tools.styl
	$(STYLUS) < $< > $@

dist/fonts:
	$(MKDIR) $@
	$(CP) ${FONT_FILES} $@

dist/fonts.css: dist/fonts
	$(WEBFONTDL) -o $@ --font-out=dist/fonts $(FONT_URLS) && sleep 1

dist/vendor.css: ${CSS_FILES} dist/fonts.css
	cat dist/fonts.css ${CSS_FILES} \
	  | sed 's,\.\./fonts,./fonts,g' \
	  > dist/temp.css
	$(CURL) ${CSS_URLS} >> dist/temp.css
	$(CLEANCSS) --skip-rebase --output $@ dist/temp.css
	$(RM) dist/temp.css

dist/vendor.js: ${JS_FILES}
	$(UGLIFYJS) --output $@ \
		--prefix 1 \
		--source-map $@.map \
		--source-map-url vendor.js.map \
		$^

# sed "s,\(=.\)dist/,\1,g" $< | $(JADE) > $@
dist/index.html: ${JADE_FILES}
	$(MKDIR) dist
	$(JADE) < $< > $@

#
# Automatically rebuild on file change
#
dist-watch:
	$(CHOKIDAR) $(WATCH_FILES) -c 'time $(MAKE) --no-print-directory dist'

#
# Deploy on apache
#

deploy: dist
	sudo -u $(APACHE_USER) $(MKDIR) $(APACHE_DIR)/$(APACHE_BASEURL)
	sudo -u $(APACHE_USER) $(CP) dist/* dist/.htaccess $(APACHE_DIR)/$(APACHE_BASEURL)
	sudo -u $(APACHE_USER) chmod u+w -R $(APACHE_DIR)/$(APACHE_BASEURL)/*
	sudo -u $(APACHE_USER) $(RM) $(APACHE_DIR)/$(APACHE_BASEURL)/ocr-gt-tools.dev.ini


#
# Docker related
#
docker:
	docker build -t 'ocr-gt-tools' .

#
# Clean up, delete files
#

clean-fonts:
	$(RM) dist/fonts dist/fonts.css

clean-%:
	$(RM) dist/$* dist/*.$* dist/*.$*.map

clean: clean-js clean-css clean-fonts clean-html

realclean:
	$(RM) bower_components node_modules
	$(RM) dist

test:
	bash ./test.sh
