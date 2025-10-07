#!/bin/bash

# make needed directories
mkdir -p build/
mkdir -p dist/

# copy src to dist/ folder
cp -r src/* dist/

# replace manifest.json with manifest-firefox.json
mv -f dist/manifest_firefox.json dist/manifest.json # for some reason the resulting archive contains both manifests and the main manifest belongs to chrome...

# put dist/ into zip file
(cd dist && zip -q -r ../build/lms-extension-firefox.zip .)

# cleanup
rm -rf dist/

# rename to firefox extension format
mv build/lms-extension-firefox.zip build/lms-extension-firefox.xpi
