#!/usr/bin/env bash
set -euo pipefail
ISO="${1:-live-image-amd64.hybrid.iso}"
[[ -f "$ISO" ]] || { echo "ISO not found: $ISO"; exit 1; }
exec qemu-system-x86_64 -m 4096 -smp 2 -cdrom "$ISO" -boot d -nic user,model=virtio-net-pci -display sdl
