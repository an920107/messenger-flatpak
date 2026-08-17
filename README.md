# Messenger Flatpak

A native GTK4 / Libadwaita desktop client for Facebook Messenger on Linux.

![Messenger Screenshot](resources/screenshot.png)

## Features

- **Native UI**: Built with GTK4 and Libadwaita for modern GNOME desktop integration.
- **Background Execution**: Hides to GNOME Background Apps when closed instead of terminating.
- **Session Persistence**: Preserves cookies and login state.
- **Lightweight**: Written in Rust with WebKitGTK 6.0.
- **Security**: Flatpak sandboxed with GPG-signed builds.

## Installation

Install the standalone `.flatpak` bundle:

```bash
flatpak install --user Messenger.flatpak
```

Run the application:

```bash
flatpak run com.squidspirit.Messenger
```

## Development

### Prerequisites

- `flatpak` and `flatpak-builder`
- GNOME 50 SDK and Rust extension:
  ```bash
  flatpak install flathub org.gnome.Sdk//50 org.gnome.Platform//50
  flatpak install flathub org.freedesktop.Sdk.Extension.rust-stable//25.08
  ```
- `git-lfs`

### Build and Install

Run the build script to compile the application, sign the build with GPG, generate the `.flatpak` bundle, and install it locally:

```bash
./build.sh
```

## License

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later). See [LICENSE](LICENSE) for details.
