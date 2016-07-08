#!/bin/bash

DOCKER_PORT=8888

usage () {
    echo "Usage: $(basename "$0") [options...] [image-dir [correction-dir]]

    Options:
        -h --help  Show this help
        -p --port  Use this local port. Default: $DOCKER_PORT

    image-dir      Directory with images (Default: ./dist/example/fileadmin)
    correction-dir Directory with corrections (Default: ./dist/example/ocr-corrections)
    "
}

while [[ "$1" = -* ]];do
    case "$1" in
        -h|--help) usage; exit ;;
        -p|--port) DOCKER_PORT="$2"; shift ;;
    esac
    shift
done

# path to the scanned images on the **host machine**
IMAGE_PATH=$1
IMAGE_PATH=${1:-$PWD/dist/example/fileadmin}
# Path to the corrections on the **host macine**
CORRECTIONS_PATH=$2
CORRECTIONS_PATH=${CORRECTIONS_PATH:-$PWD/dist/example/ocr-corrections}
# Name of the image file
DOCKER_IMAGE="kbai/ocr-gt-tools"
# Name of the container
DOCKER_APP="ocr-gt-app"

declare -a DOCKER_RUNARGS
# Map ports
DOCKER_RUNARGS+=("-p" "${DOCKER_PORT}:80")
# Interactive and with terminal
# DOCKER_RUNARGS+=("-it")
# Delete container after run
DOCKER_RUNARGS+=("--rm")
# Ignore SIGWINCH
DOCKER_RUNARGS+=("--sig-proxy=false")
# Set application name
DOCKER_RUNARGS+=("--name" "$DOCKER_APP")
# Mount <image-dir>
DOCKER_RUNARGS+=("--volume=${IMAGE_PATH}:/data/fileadmin")
# Mount <correction-dir>
DOCKER_RUNARGS+=("--volume=${CORRECTIONS_PATH}:/data/ocr-corrections")
# DOCKER_RUNARGS+=("--privileged=true")

# Run docker
echo docker run "${DOCKER_RUNARGS[@]}" "$DOCKER_IMAGE"
docker run "${DOCKER_RUNARGS[@]}" "$DOCKER_IMAGE"
