#!/bin/bash
ocrBaseDir="$(dirname "$(readlink -f "$0")")"

hocr="$1"
imageDir="$2"
html="$3"
comments="$4"

if [[ -e "$html" ]];then
    echo "$html already exists!" >&2
    exit 0
fi

# Make sure the 'correction-dir' exists
mkdir -p "$(dirname "$html")"
tempdir=$(mktemp -d)
cd "$tempdir"


"$ocrBaseDir/vendor/hocr-tools/hocr-extract-images" -b "$imageDir" "$hocr"
"$ocrBaseDir/vendor/ocropy/ocropus-gtedit" html -x xxx line*.png
mv -v correction.html "$html"


touch anmerkungen.txt
nrLines=$(find "$tempdir" -name '*.txt'|wc -l)
lineIdx=0
while ((lineIdx < nrLines));do
    printf "%03d: " >> anmerkungen.txt
    lineIdx=$((lineIdx + 1))
done

mv anmerkungen.txt "$comments"


rm -rf "$tempdir"
