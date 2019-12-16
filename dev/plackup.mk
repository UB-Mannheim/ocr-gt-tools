.PHONY: dev-server dev-browser dist-watch

# Port of the dev server
PLACKUP_PORT = 9090

# "Plackup is a command line utility to run PSGI applications from the command line"
# https://en.wikipedia.org/wiki/Plack_(software)
PLACKUP_OPTS  = --port $(PLACKUP_PORT) -R
PLACKUP       = plackup $(PLACKUP_OPTS)

# Chokidar is a file system change watcher (think: inotify)
# https://github.com/kimmobrunfeldt/chokidar-cli
CHOKIDAR_OPTS = --verbose --polling --initial --debounce 100
CHOKIDAR      = chokidar $(CHOKIDAR_OPTS)

# The files to watch for changes for to trigger a rebuild
WATCH_FILES = Makefile ocr-gt-tools.* ${PUG_FILES} *.json js/**/*.js js/*.js

#
# Run the development standalone server on port 9090
#

dev-server:
	echo $(PWD)
	$(PLACKUP) dev/app.psgi

dev-browser:
	xdg-open http://localhost:9090/dist/index.html

#
# Automatically rebuild on file change
#
dist-watch:
	$(CHOKIDAR) $(WATCH_FILES) -c 'time $(MAKE) --no-print-directory dist'

