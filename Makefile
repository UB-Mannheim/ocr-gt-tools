DEBIAN_PACKAGES = git libconfig-inifiles-perl python-numpy python-scipy python-matplotlib
DEV_DEBIAN_PACKAGES = npm libplack-perl 

MKDIR = mkdir -p
GIT_CLONE = git clone --depth 1
RM = rm -rf

APT_GET_OPTS = -y
APT_GET = sudo apt-get $(APT_GET_OPTS)

NPM_OPTS =
NPM = npm $(NPM_OPTS)
PLACKUP = plackup --port 9090
BOWER = bower
CLEANCSS = cleancss
UGLIFYJS = uglifyjs
WEBFONTDL = webfont-dl

FONTS = https://fonts.googleapis.com/css?family=EB+Garamond&subset=latin,latin-ext
CSS_FILES = bower_components/bootstrap/dist/css/bootstrap.css \
			css/ocr-gt-tools.css
JS_FILES =  bower_components/jquery/dist/jquery.js \
			bower_components/bootstrap/dist/js/bootstrap.js \
			js/ocr-gt-tools.js

export PATH := $(PWD)/node_modules/.bin:$(PATH)

.PHONY: clean clean-js clean-css \
  deps apt-get \
  dev-deps dev-apt-get \
  node_modules bower_components \
  dev-server

#
# Dependencies to execute ocropy / hocr-tools in a CGI environment
#

deps: apt-get vendor

apt-get:
	$(APT_GET) install $(DEBIAN_PACKAGES)

vendor: vendor/hocr-tools vendor/ocropy

vendor/hocr-tools:
	$(MKDIR) vendor
	$(GIT_CLONE) https://github.com/UB-Mannheim/hocr-tools $@

vendor/ocropy:
	$(MKDIR) vendor
	$(GIT_CLONE) https://github.com/tmbdev/ocropy $@

#
# Options for development
#

# Sanity check to prevent running without a config file
conf/ocr-gt-tools.ini:
	@echo "Copy conf/ocr-gt-tools.ini_tmpl to conf/ocr-gt-tools.ini and set paths."
	exit 1

dev-server: conf/ocr-gt-tools.ini vendor
	$(PLACKUP) -R cgi-bin app.psgi

node_modules:
	$(NPM) install

bower_components: node_modules
	$(BOWER) install

dev-apt-get:
	$(APT_GET) install $(DEV_DEBIAN_PACKAGES)

dev-deps: dev-apt-get bower_components
	$(NPM) $(NPM_OPTS) install

#
# Set up dist folder
#

dist: dist/style.css dist/script.js dist/fonts

${CSS_FILES}: bower_components

dist/style.css: dist/fonts ${CSS_FILES}
	$(MKDIR) dist/css
	cp ${CSS_FILES} dist/css
	$(CLEANCSS) --output $@ ${CSS_FILES}

dist/script.js: ${JS_FILES}
	$(MKDIR) dist/js
	cp ${JS_FILES} dist/js
	cd dist && $(UGLIFYJS) --output script.js \
		--source-map script.js.map \
		js/jquery.js \
		js/bootstrap.js \
		js/ocr-gt-tools.js

dist/fonts:
	$(MKDIR) dist/css
	$(WEBFONTDL) -o dist/css/font.css --font-out=$@ ${FONTS}

clean-fonts:
	$(RM) dist/fonts
	$(RM) css/font.css

clean-css:
	$(RM) dist/*.css*

clean-js:
	$(RM) dist/js dist/*.js*

clean: clean-js clean-css clean-fonts

realclean:
	$(RM) bower_components node_modules
