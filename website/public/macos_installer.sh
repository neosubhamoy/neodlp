#!/bin/bash

# Config
OWNER="neosubhamoy"
REPO="neodlp"
DOWNLOAD_DIR=$(mktemp -d)

# Check if NeoDLP is already installed
echo "### === NeoDLP Installer (MacOS) === ###"
echo "🔍 Checking system requirements..."
if [ -d "/Applications/NeoDLP.app" ]; then
    echo "⚠️ NeoDLP is already installed at /Applications/NeoDLP.app"
    echo "🔄 Proceeding with reinstallation/update..."
fi

# Detect system architecture
ARCH=$(uname -m)

if [[ "$ARCH" == "arm64" ]]; then
    ASSET_NAME="NeoDLP_aarch64.app.tar.gz"
    echo "🧠 Detected Apple Silicon Mac (arm64)"
elif [[ "$ARCH" == "x86_64" ]]; then
    ASSET_NAME="NeoDLP_x64.app.tar.gz"
    echo "🧠 Detected Intel-based Mac (x86_64)"
else
    echo "❌ Unsupported architecture: $ARCH"
    echo "🛑 Installation aborted."
    exit 1
fi

# Get the latest release tag from GitHub API
TAG=$(curl -s https://api.github.com/repos/$OWNER/$REPO/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

# Construct the full download URL
URL="https://github.com/$OWNER/$REPO/releases/download/$TAG/$ASSET_NAME"

# Download the release asset
echo "⬇️ Downloading $ASSET_NAME from tag $TAG..."
curl -fL -o "$DOWNLOAD_DIR/$ASSET_NAME" "$URL"

# Check if download succeeded
if [ ! -f "$DOWNLOAD_DIR/$ASSET_NAME" ]; then
    echo "❌ Download failed!"
    exit 1
fi

# Extract the archive
if ! tar -xzf "$DOWNLOAD_DIR/$ASSET_NAME" -C "$DOWNLOAD_DIR"; then
    echo "❌ Failed to extract the archive!"
    exit 1
fi

# Move the .app to /Applications directory
APP_NAME="NeoDLP.app"
echo "📦 Moving $APP_NAME to /Applications directory (sudo required)"
# Remove existing installation if present
if [ -d "/Applications/$APP_NAME" ]; then
    echo "🗑️ Removing existing installation..."
    sudo rm -rf "/Applications/$APP_NAME"
fi
sudo mv "$DOWNLOAD_DIR/$APP_NAME" /Applications/

# Clean up the downloaded archive
echo "🧹 Cleaning up..."
rm "$DOWNLOAD_DIR/$ASSET_NAME"

if [ -d "/Applications/$APP_NAME" ]; then
    echo "✅ NeoDLP Installation successful!"
    exit 0
else
    echo "❌ NeoDLP Installation failed!"
    exit 1
fi