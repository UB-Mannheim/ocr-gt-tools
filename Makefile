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

WEBFONTS  = https://fonts.googleapis.com/css?family=EB+Garamond&subset=latin,latin-ext
FONTS     = bower_components/font-awesome/fonts/fontawesome-webfont.*
CSS_FILES = bower_components/bootstrap/dist/css/bootstrap.css \
            bower_components/font-awesome/css/font-awesome.css \
            dist/fonts.css
JS_FILES  = bower_components/jquery/dist/jquery.js \
            bower_components/bootstrap/dist/js/bootstrap.js

export PATH := $(PWD)/node_modules/.bin:$(PATH)

.PHONY: clean clean-js clean-css \
  deps apt-get \
  dev-deps dev-apt-get \
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
	$(NPM) $(NPM_OPTS) install

bower_components: node_modules
	$(BOWER) install

dev-apt-get:
	$(APT_GET) install $(DEV_DEBIAN_PACKAGES)

dev-deps: dev-apt-get bower_components

#
# Set up dist folder
#

dist: dist/vendor.css dist/vendor.js dist/fonts

dist/vendor.css: ${CSS_FILES} dist/fonts.css
	cat ${CSS_FILES} | sed 's,\.\.,\.,g' | $(CLEANCSS) --skip-rebase --output $@

dist/vendor.js: ${JS_FILES}
	$(UGLIFYJS) --output $@ \
		--prefix 1 \
		--source-map $@.map \
		--source-map-url vendor.js.map \
		$^

dist/fonts: bower_components
	$(MKDIR) $@
	@cp ${FONTS} $@

dist/fonts.css: dist/fonts
	@$(WEBFONTDL) -o $@ --font-out=dist/fonts ${WEBFONTS}


#
# Clean up, delete files
#

clean-fonts:
	$(RM) dist/fonts
	$(RM) dist/fonts.css

clean-css:
	$(RM) dist/css dist/*.css*

clean-js:
	$(RM) dist/js dist/*.js*

clean: clean-js clean-css clean-fonts

realclean:
	$(RM) bower_components node_modules
	$(RM) dist
