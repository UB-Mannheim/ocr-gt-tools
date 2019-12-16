# Add node_modules/.bin to $PATH so the CLI tools
# installed locally by npm can be used
export PATH := $(PWD)/node_modules/.bin:$(PATH)

include \
	dev/apache.mk \
	dev/debian.mk \
	dev/docker.mk \
	dev/plackup.mk
#
# Define all the CLI tools to use
#

# Standard UNIX tools, recurse, create parents, force delete
MKDIR = mkdir -p
RM    = rm -rf
CP    = cp -r
GIT_CLONE = git clone --depth 1

# cURL to download files
CURL          = curl -s
# clean-css is a CSS minifier and optimizer
CLEANCSS      = cleancss
# UglifyJS minifies, merges and optimizes Javascript
UGLIFYJS      = uglifyjs
# webfont-dl is a tool to download web fonts from the Google Fonts API
WEBFONTDL     = webfont-dl --eot=omit --ttf=data --woff1=data
# Pug is a templating engine
PUG           = pug --pretty
# Stylus is a CSS compiler
STYLUS  = stylus

#
# Define lists of assets
#

# URLs of Web Fonts to embed
FONT_URLS = https://fonts.googleapis.com/css?family=EB+Garamond&subset=latin,latin-ext
# Font files (eot, ttf, woff...) to bundle
FONT_FILES = node_modules/font-awesome/fonts/fontawesome-webfont.* \
             node_modules/bootstrap/fonts/glyphicons-halflings-regular.*
# URLs of CSS to download
CSS_URLS = https://getbootstrap.com/examples/dashboard/dashboard.css
# CSS files to bundle into one minified `dist/vendor.css`
# NOTE: Our CSS should not be bundled here
CSS_FILES   = node_modules/reset-css/reset.css \
              node_modules/bootstrap/dist/css/bootstrap.css \
              node_modules/notie/dist/notie.css \
              node_modules/font-awesome/css/font-awesome.css
# JS scripts to bundle into one minified `dist/vendor.js`
# NOTE: Javascript developed by us should not be bundled here
VENDOR_JS_FILES  = node_modules/jquery/dist/jquery.js \
                   node_modules/async/dist/async.min.js \
                   node_modules/bootstrap/dist/js/bootstrap.js \
                   node_modules/handlebars/dist/handlebars.min.js \
                   node_modules/clipboard/dist/clipboard.js \
                   node_modules/notie/dist/notie.js

JS_FILES = js/*.js js/**/*.js ocr-gt-tools.js ocr-gt-tools.js
# The HTML files, described in the Pug shorthand / templating language
PUG_FILES  = ocr-gt-tools.pug

#
# Define the list of targets that will "always fail", i.e. the CLI api
#
# clean-js clean-html clean-fonts clean-css \

.PHONY: debug clean vendor

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

vendor: dist/vendor/hocr-tools dist/vendor/ocropy

dist/vendor/hocr-tools:
	$(MKDIR) dist/vendor
	$(GIT_CLONE) https://github.com/UB-Mannheim/hocr-tools $@

dist/vendor/ocropy:
	$(MKDIR) dist/vendor
	$(GIT_CLONE) https://github.com/tmbdev/ocropy $@

#
# Set up dist folder
#

dist: \
	dist/special-chars.json\
	dist/error-tags.json\
	dist/vendor\
	dist/log\
	dist/vendor.css\
	dist/vendor.js\
	dist/fonts\
	dist/index.html\
	dist/ocr-gt-tools.js\
	dist/ocr-gt-tools.css\
	dist/ocr-gt-tools.cgi

dist/%.json: doc/%.json
	$(CP) $< $@

dist/log:
	$(MKDIR) $@

dist/ocr-gt-tools.cgi: ocr-gt-tools.cgi
	$(CP) $< $@
	chmod a+x $@

#$(UGLIFYJS) --compress --output $@ $^
dist/ocr-gt-tools.js: $(JS_FILES)
	cat $^ > $@

dist/ocr-gt-tools.css: ocr-gt-tools.styl
	$(STYLUS) < $< > $@

dist/fonts:
	$(MKDIR) $@
	$(CP) ${FONT_FILES} $@

dist/fonts.css: dist/fonts
	$(WEBFONTDL) -o $@ --font-out=dist/fonts $(FONT_URLS) && wait

dist/vendor.css: ${CSS_FILES} dist/fonts.css
	cat dist/fonts.css ${CSS_FILES} \
	  | sed 's,\.\./fonts,./fonts,g' \
	  > dist/temp.css
	$(CURL) ${CSS_URLS} >> dist/temp.css
	$(CLEANCSS) --skip-rebase --output $@ dist/temp.css
	$(RM) dist/temp.css

dist/vendor.js: ${VENDOR_JS_FILES}
	$(UGLIFYJS) --output $@ \
		--prefix 1 \
		--source-map $@.map \
		--source-map-url vendor.js.map \
		$^

# sed "s,\(=.\)dist/,\1,g" $< | $(PUG) > $@
dist/index.html: ${PUG_FILES}
	$(MKDIR) dist
	$(PUG) < $< > $@

#
# Clean up, delete files
#

clean-fonts:
	$(RM) dist/fonts dist/fonts.css

clean-%:
	$(RM) dist/$* dist/*.$* dist/*.$*.map

clean: clean-js clean-css clean-fonts clean-html

realclean:
	$(RM) node_modules
	$(RM) dist

test:
	bash ./test.sh
