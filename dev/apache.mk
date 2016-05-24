.PHONY: deploy

APACHE_USER = www-data
APACHE_GROUP = www-data
APACHE_DIR = /var/www/html
APACHE_BASEURL = ocr-gt
SUDO_APACHE = sudo -u $(APACHE_USER)

#
# Deploy on apache
#

deploy:
	$(SUDO_APACHE) mkdir -p "$(APACHE_DIR)/$(APACHE_BASEURL)"
	$(SUDO_APACHE) cp -r dist/* dist/.htaccess "$(APACHE_DIR)/$(APACHE_BASEURL)"
	$(SUDO_APACHE) find "$(APACHE_DIR)/$(APACHE_BASEURL)" -exec chmod u+w -R {} \;
	$(SUDO_APACHE) find "$(APACHE_DIR)/$(APACHE_BASEURL)" -exec chown $(APACHE_USER):$(APACHE_GROUP) {} \;
