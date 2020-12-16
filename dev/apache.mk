.PHONY: deploy

APACHE_USER = www-data
APACHE_GROUP = www-data
APACHE_DIR = /var/www/html
APACHE_BASEURL = ocr-gt
SUDO = sudo

#
# Deploy on apache
#

deploy:
	$(SUDO) mkdir -p "$(APACHE_DIR)/$(APACHE_BASEURL)"
	$(SUDO) cp -r dist/* dist/.htaccess "$(APACHE_DIR)/$(APACHE_BASEURL)"
	$(SUDO) chown -R $(APACHE_USER):$(APACHE_GROUP) "$(APACHE_DIR)/$(APACHE_BASEURL)"
	$(SUDO) chmod -R u+w "$(APACHE_DIR)/$(APACHE_BASEURL)"
