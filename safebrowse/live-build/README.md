# SafeBrowse OS live-build scaffold

This scaffold builds a Debian-based live ISO that is:
- Tor-routed by default
- network kill-switched when Tor is down
- ephemeral by default
- optionally persistent via encrypted storage helper

## Prerequisites

```bash
sudo apt-get update
sudo apt-get install -y live-build
```

## Build

```bash
cd safebrowse/live-build
./build-iso.sh
```

Output ISO appears under `safebrowse/live-build/` (usually `live-image-amd64.hybrid.iso`).

## Notes
- This is an MVP scaffold; tune packages and policies before production.
- Tor Browser package availability can vary by Debian release; if unavailable, replace launcher command accordingly.
- The build hook rewrites `TOR_UID` in `/etc/nftables.conf` to match the target image's `debian-tor` UID, avoiding hard-coded UID drift.


## Run locally in QEMU

```bash
cd safebrowse/live-build
./build-iso.sh
./scripts/run-qemu.sh live-image-amd64.hybrid.iso
```

## Write to USB for real PC boot

⚠️ This erases the target USB device.

```bash
cd safebrowse/live-build
sudo ./scripts/write-usb.sh live-image-amd64.hybrid.iso /dev/sdX
```

Then reboot your PC, open BIOS/UEFI boot menu, and boot from that USB.

## First boot checklist on your PC

- If Secure Boot blocks unsigned live images, disable Secure Boot for this USB test.
- Verify Tor routing in browser (`https://check.torproject.org`).
- Confirm kill-switch: stop `tor` and verify browsing fails.
- Reboot and confirm session data is gone unless you mounted persistence.
