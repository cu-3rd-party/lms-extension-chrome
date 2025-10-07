#!/bin/bash

# make needed directories
mkdir -p build/chrome-debug/
rm -rf build/chrome-debug/* # clean chrome debug directory from previous build artifacts
mkdir -p dist/

# construct extension source code
cp -r src/* dist/
rm dist/manifest_firefox.json

cp -r dist/* build/chrome-debug/

# put dist/ into zip file
(cd dist && zip -q -r ../build/lms-extension-chrome.zip .)

# cleanup
rm -rf dist/
