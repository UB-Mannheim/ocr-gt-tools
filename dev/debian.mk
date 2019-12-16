.PHONY: apt-get dev-apt-get

# Debian packages required for running the backend
DEBIAN_PACKAGES = \
	git \
	libcgi-pm-perl \
	libjson-perl \
	libhash-merge-perl \
	libyaml-perl \
	libipc-run-perl \
	python-fabio \
	python-lxml \
	python-numpy \
	python-scipy \
	python-matplotlib

# Debian packages required for running the dev-server and rebuild the frontend
DEV_DEBIAN_PACKAGES = \
	cleancss \
	npm \
	libplack-perl \
	curl

# Install debian packages, non-interactively
APT_GET = apt-get -y

#
# Dependencies to execute ocropy / hocr-tools in a CGI environment
#
apt-get:
	$(APT_GET) install $(DEBIAN_PACKAGES)

dev-apt-get:
	$(APT_GET) install $(DEV_DEBIAN_PACKAGES)

