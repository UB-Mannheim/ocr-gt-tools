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

CSS_FILES = bower_components/bootstrap/dist/css/bootstrap.css \
			css/ocr-gt-tools.css
JS_FILES =  bower_components/jquery/dist/jquery.js \
			bower_components/bootstrap/dist/js/bootstrap.js \
			js/ocr-gt-tools.js

export PATH := ./node_modules/.bin:$(PATH)

.PHONY: deps apt-get \
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

dist: dist/ocr-gt-tools.css dist/ocr-gt-tools.js

dist/ocr-gt-tools.css: ${CSS_FILES}
	$(MKDIR) dist
	$(CLEANCSS) --output $@ --source-map $^

dist/ocr-gt-tools.js: ${JS_FILES}
	$(MKDIR) dist
	$(UGLIFYJS) --output $@ --source-map dist/ocr-gt-tools.js.map $^

dev-apt-get:
	$(APT_GET) install $(DEV_DEBIAN_PACKAGES)

dev-deps: dev-apt-get bower_components
	$(NPM) $(NPM_OPTS) install

clean:
	$(RM) dist
