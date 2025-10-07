# Create needed directories
New-Item -ItemType Directory -Force -Path "build" | Out-Null
New-Item -ItemType Directory -Force -Path "dist" | Out-Null

# Copy src to dist folder
Copy-Item -Recurse -Force "src\*" "dist\"

# Replace manifest.json with manifest_firefox.json
Move-Item -Force "dist\manifest_firefox.json" "dist\manifest.json"

# Create ZIP archive of dist/
Compress-Archive -Path "dist\*" -DestinationPath "build\lms-extension-firefox.zip" -Force

# Cleanup dist folder
Remove-Item -Recurse -Force "dist"

# Rename .zip to .xpi (Firefox extension format)
Rename-Item -Force "build\lms-extension-firefox.zip" "lms-extension-firefox.xpi"
