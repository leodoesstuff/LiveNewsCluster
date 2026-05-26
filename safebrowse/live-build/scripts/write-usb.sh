#!/usr/bin/env bash
set -euo pipefail

ISO="${1:-live-image-amd64.hybrid.iso}"
DEVICE="${2:-}"

if [[ -z "$DEVICE" ]]; then
  echo "Usage: sudo $0 <iso-path> <usb-device>"
  echo "Example: sudo $0 live-image-amd64.hybrid.iso /dev/sdb"
  exit 1
fi

if [[ ! -f "$ISO" ]]; then
  echo "ISO not found: $ISO"
  exit 1
fi

if [[ ! -b "$DEVICE" ]]; then
  echo "Not a block device: $DEVICE"
  exit 1
fi

echo "About to WIPE and write $ISO to $DEVICE"
read -r -p "Type 'YES' to continue: " ACK
[[ "$ACK" == "YES" ]] || { echo "Aborted"; exit 1; }

umount "${DEVICE}"* || true

dd if="$ISO" of="$DEVICE" bs=4M status=progress conv=fsync
sync

echo "Done. You can now boot from $DEVICE on your PC."
