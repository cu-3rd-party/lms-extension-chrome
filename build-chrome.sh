#!/bin/bash

# make needed directories
mkdir -p build/
mkdir -p dist/

# copy src to dist/ folder
cp -r src/* dist/

# replace manifest.json with manifest_firefox.json
rm dist/manifest_firefox.json

# put dist/ into zip file
(cd dist && zip -q -r ../build/lms-extension-chrome.zip .)

# cleanup
rm -rf dist/
