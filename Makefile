DEBIAN_PACKAGES = git libplack-perl libconfig-inifiles-perl python-numpy python-scipy python-matplotlib npm
NPM_PACKAGES = bower grunt-cli

APT_GET_OPTS = -y
APT_GET = sudo apt-get $(APT_GET_OPTS)
NPM_OPTS = -v
NPM = npm $(NPM_OPTS)
PLACKUP = plackup --port 9090
MKDIR = mkdir -p
GIT_CLONE = git clone --depth 1
export PATH := ./node_modules/.bin:$(PATH)

.PHONY: deps apt-get dev-server npm bower

deps: apt-get npm bower vendor

bower: npm
	bower install jquery

npm:
	$(NPM) $(NPM_OPTS) install $(NPM_PACKAGES)

apt-get:
	$(APT_GET) install $(DEBIAN_PACKAGES)

vendor: vendor/hocr-tools vendor/ocropy

vendor/hocr-tools:
	$(MKDIR) vendor
	$(GIT_CLONE) https://github.com/UB-Mannheim/hocr-tools $@

vendor/ocropy:
	$(MKDIR) vendor
	$(GIT_CLONE) https://github.com/tmbdev/ocropy $@

conf/ocr-gt-tools.ini:
	@echo "Copy conf/ocr-gt-tools.ini_tmpl to conf/ocr-gt-tools.ini and set paths."
	exit 1

dev-server: conf/ocr-gt-tools.ini vendor
	$(PLACKUP) -R cgi-bin app.psgi
