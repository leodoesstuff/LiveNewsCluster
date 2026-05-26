#!/usr/bin/env bash
set -euo pipefail

ISO="${1:-live-image-amd64.hybrid.iso}"
RAM_MB="${RAM_MB:-4096}"
CPUS="${CPUS:-2}"

if [[ ! -f "$ISO" ]]; then
  echo "ISO not found: $ISO"
  echo "Build first: ./build-iso.sh"
  exit 1
fi

exec qemu-system-x86_64 \
  -enable-kvm \
  -m "$RAM_MB" \
  -smp "$CPUS" \
  -cpu host \
  -cdrom "$ISO" \
  -boot d \
  -nic user,model=virtio-net-pci \
  -display sdl
