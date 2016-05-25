#!/bin/bash

set -ex

ocrBaseDir="$(dirname "$(readlink -f "$0")")"

hocr="$1"
imageDir="$2"
correctionDir="$3"

if [[ ! -e "$hocr" ]];then
  echo "hocr '$hocr' does not exist"
  exit 1
fi
if [[ ! -d "$imageDir" ]];then
  echo "imageDir '$imageDir' is not a directory"
  exit 1
fi
if [[ -z "$correctionDir" ]];then
  echo "correctionDir not given"
  exit 1
fi

# Make sure the 'correction-dir' exists
mkdir -p "$correctionDir"
cd "$correctionDir"
"$ocrBaseDir/vendor/hocr-tools/hocr-extract-images" -b "$imageDir" -p 'line-%04d.png' "$hocr"
for i in line-*.txt;do
  echo -ne "\n" >> "$i"
  echo -e " " > "comment-$i"
done
echo -e " " > "comment-page.txt"
