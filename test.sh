#!/bin/bash
PORT=9091
SAMPLE_URL="http://example.org/fileadmin/digi/445442158/thumbs/445442158_0126.jpg"
SAMPLE_THUMB="example/fileadmin/digi/445442158/thumbs/445442158_0126.jpg"
SAMPLE_CORR="example/ocr-corrections/digi/445442158/gt/0126/correction.html"
SAMPLE_COMM="example/ocr-corrections/digi/445442158/gt/0126/anmerkungen.txt"

# rm request log files, samples, start the server, wait a second, see if it's still running
start_server() {
    rm -f log/request.log $SAMPLE_COMM $SAMPLE_CORR
    plackup --port=$PORT app.psgi & SERVER_PID=$!
    sleep 1
    ps -p $SERVER_PID 2>/dev/null
}

stop_server() {
    pkill $SERVER_PID && true
}

# Test history
test_history() {
    curl -i "http://localhost:$PORT/ocr-gt-tools.cgi?action=history"
}

# Test create
test_create() {
    [[ ! -e $SAMPLE_COMM ]];
    [[ ! -e $SAMPLE_CORR ]];
    curl -i "http://localhost:$PORT/ocr-gt-tools.cgi?action=create&imageUrl=$SAMPLE_URL"
    [[ -e $SAMPLE_COMM ]];
    [[ -e $SAMPLE_CORR ]];
}


# -x Trace steps 
# -e exit on first non-null return value
set -e

# Stop the server for failing tests
trap stop_server EXIT

start_server

test_create
test_history

stop_server
