#!/bin/bash

make dev-server & SERVER_PID=$!

sleep 1

curl -si 'http://localhost:9090/ocr-gt-tools.cgi?action=history'

kill $SERVER_PID
