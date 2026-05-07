# telegramTestOne

Raspberry Pi 4 development and SD-card image scaffold.

This repository is ready for two related workflows:

1. A virtual development shell that runs an ARM64 Debian Bookworm userspace, which is close to Raspberry Pi OS Lite on a Raspberry Pi 4.
2. A later SD-card export workflow that customizes an official Raspberry Pi OS Lite image with this repository and first-boot setup.

## Does the SD card need the OS?

Yes. A Raspberry Pi boots directly from the SD card, so the card must contain:

- Raspberry Pi firmware and boot files
- the Linux kernel
- the root filesystem
- your application files and setup

The virtual development shell is useful for building and testing dependencies before the hardware arrives, but it is not the bootable OS by itself. The `pi-image` workflow starts from an official Raspberry Pi OS image and adds this repository plus your configuration.

## Prerequisites

For the virtual development shell:

- Docker with ARM64 emulation enabled. Docker Desktop usually includes this. On Linux, install `qemu-user-static` or equivalent if ARM64 containers do not start.

For SD-card image generation:

- Linux host
- `sudo`
- `curl`, `xz`, `tar`, `losetup`, `mount`, `openssl`, and `sha256sum`
- kernel support for mounting `vfat` filesystems, because the Raspberry Pi boot partition is FAT
- enough disk space for the downloaded and expanded Raspberry Pi OS image

## Quick start

Copy the example config and edit the values before building an SD image:

```sh
cp config/pi-image.env.example config/pi-image.env
${EDITOR:-nano} config/pi-image.env
```

Open a Pi-like development shell:

```sh
make pi-dev-shell
```

Validate local scripts:

```sh
make pi-validate
```

Build a customized Raspberry Pi OS SD-card image:

```sh
make pi-image
```

The generated image is written to `dist/`. Flash it to an SD card with Raspberry Pi Imager, Balena Etcher, or `dd`.

## Configuration

`config/pi-image.env.example` documents the settings used by `scripts/build-pi-sd-image.sh`.

Important values:

- `PI_USERNAME` and `PI_PASSWORD` create the first login account.
- `PI_SSH_PUBLIC_KEY` installs an SSH key for passwordless login.
- `PI_WIFI_SSID`, `PI_WIFI_PASSWORD`, and `PI_WIFI_COUNTRY` configure Wi-Fi on first boot.
- `PI_HOSTNAME` sets the Pi hostname.
- `PI_APP_DIR` controls where this repository is copied on the Pi.

Do not commit `config/pi-image.env`; it can contain passwords or Wi-Fi credentials.

## First boot on the Raspberry Pi

On first boot, the customized image:

- enables SSH
- creates the configured user through Raspberry Pi OS boot configuration
- copies this repository to `PI_APP_DIR`
- installs a first-boot systemd service
- installs baseline packages such as `git`, `curl`, `python3`, `python3-venv`, and `python3-pip`
- optionally creates a NetworkManager Wi-Fi profile when Wi-Fi settings are provided

After the first boot finishes, SSH in with:

```sh
ssh <PI_USERNAME>@<PI_HOSTNAME>.local
```

## Notes for Raspberry Pi 4 2GB

The default image URL targets Raspberry Pi OS Lite 64-bit Bookworm, which works on a Raspberry Pi 4 with 2GB RAM. If you later need maximum memory headroom or a dependency is only packaged for 32-bit Raspberry Pi OS, switch `PI_IMAGE_URL` to an official 32-bit Lite image and rebuild.

## Troubleshooting

If `make pi-image` reports that the host cannot mount `vfat` boot partitions, run the image build on a Linux machine with FAT filesystem support enabled. On many Linux distributions this is available by default; on minimal VMs you may need to install/load the `vfat` kernel module first.