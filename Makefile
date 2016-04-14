DEBIAN_PACKAGES = git libplack-perl libconfig-inifiles-perl
APT_GET = sudo apt-get -y
PLACKUP = plackup --port 9090
MKDIR = mkdir -p
GIT_CLONE = git clone --depth 1

.PHONY: deps apt-get dev-server

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

conf/ocr-gt-tools.ini:
	@echo "Copy conf/ocr-gt-tools.ini_tmpl to conf/ocr-gt-tools.ini and set paths."
	exit 1

dev-server: conf/ocr-gt-tools.ini vendor
	$(PLACKUP) -R cgi-bin app.psgi
