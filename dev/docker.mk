.PHONY: docker docker-run docker-run-bash

DOCKER_IMAGE = ocr-gt-tools
DOCKER_PORT = 12345
MOUNT_DIR = $(PWD)/dist/example
CONFIG_FILE = $(PWD)/doc/ocr-gt-tools.docker.yml

#
# Docker related
#
docker:
	docker build -t kbai/$(DOCKER_IMAGE) .

docker-run: docker
	@echo Running on http://localhost:$(DOCKER_PORT)/ocr-gt/
	docker run -it --rm -p $(DOCKER_PORT):80 \
		--volume="$(MOUNT_DIR):/data" \
		--volume="$(CONFIG_FILE):/usr/local/apache2/htdocs/ocr-gt/ocr-gt-tools.yml" \
		$(DOCKER_IMAGE) $(DOCKER_COMMAND)

docker-run-bash:
	$(MAKE) docker-run DOCKER_COMMAND=bash
