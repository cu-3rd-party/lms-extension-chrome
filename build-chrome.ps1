# make needed directories
New-Item -ItemType Directory -Force -Path "build/chrome-debug" | Out-Null
New-Item -ItemType Directory -Force -Path "dist" | Out-Null

# clean chrome debug directory from previous build artifacts
Remove-Item -Recurse -Force "build/chrome-debug\*" -ErrorAction SilentlyContinue

# construct extension source code
Copy-Item -Recurse -Force "src\*" "dist\"
Remove-Item -Force "dist\manifest_firefox.json" -ErrorAction SilentlyContinue

Copy-Item -Recurse -Force "dist\*" "build/chrome-debug\"

# put dist/ into zip file
if (Test-Path "build\lms-extension-chrome.zip") {
    Remove-Item -Force "build\lms-extension-chrome.zip"
}
Compress-Archive -Path "dist\*" -DestinationPath "build\lms-extension-chrome.zip"

# cleanup
Remove-Item -Recurse -Force "dist"
