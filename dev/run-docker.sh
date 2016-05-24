#!/bin/bash
# path to the scanned images on the **host machine**
IMAGE_PATH=$1
IMAGE_PATH=${IMAGE_PATH:-$PWD/dist/example/fileadmin}
# Path to the corrections on the **host macine**
CORRECTIONS_PATH=$2
CORRECTIONS_PATH=${CORRECTIONS_PATH:-$PWD/dist/example/ocr-corrections}

docker run -p 8888:80 -it --rm --name "$DOCKER_IMAGE" \
    --volume="$IMAGE_PATH:/data/fileadmin" \
    --volume="$CORRECTIONS_PATH:/data/ocr-corrections" \
    kbai/ocr-gt-tools:docker
