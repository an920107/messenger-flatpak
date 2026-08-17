#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GPG_KEY_ID="FAD3540C51402C39642F344669703881A4876C1A"

echo "==> 1. Exporting public GPG key..."
mkdir -p "$SCRIPT_DIR/resources"
gpg --export "$GPG_KEY_ID" > "$SCRIPT_DIR/resources/local.gpg"

echo "==> 2. Building com.squidspirit.Messenger with GPG signing and AppStream metadata..."
# Clean up any legacy manual .desktop files to prevent duplicate entries
rm -f "$HOME/.local/share/applications/messenger.desktop" "$HOME/.local/share/applications/pake-messenger.desktop"

# Build into temporary OSTree repository
flatpak-builder --disable-rofiles-fuse --force-clean --gpg-sign="$GPG_KEY_ID" --repo=.repo .flatpak-build com.squidspirit.Messenger.yml

echo "==> 3. Exporting standalone .flatpak bundle..."
flatpak build-bundle \
    --gpg-keys="$SCRIPT_DIR/resources/local.gpg" \
    --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo \
    .repo "$SCRIPT_DIR/Messenger.flatpak" com.squidspirit.Messenger

echo "==> 4. Installing from Messenger.flatpak bundle..."
# Uninstall previous version cleanly to avoid stale remote errors
flatpak uninstall -y --user com.squidspirit.Messenger 2>/dev/null || true
flatpak install -y --user "$SCRIPT_DIR/Messenger.flatpak"

# Cleanup temporary build directories
rm -rf .flatpak-build .flatpak-builder .repo target 2>/dev/null || true

echo "==> 5. Updating desktop database..."
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
update-desktop-database "$HOME/.local/share/flatpak/exports/share/applications" 2>/dev/null || true

echo "Build, bundle packaging, and installation completed successfully!"
echo "Standalone bundle ready: $SCRIPT_DIR/Messenger.flatpak"
