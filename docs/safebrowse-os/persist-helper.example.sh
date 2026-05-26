#!/usr/bin/env bash
set -euo pipefail

# Example helper for optional persistence volume management.
# NOTE: Review before production use.

PERSIST_DEVICE="${1:-/dev/sdb1}"
MAPPER_NAME="safebrowse-persist"
MOUNT_POINT="/persist"

init_luks() {
  echo "[+] Initializing LUKS2 on ${PERSIST_DEVICE}"
  cryptsetup luksFormat --type luks2 "${PERSIST_DEVICE}"
}

open_luks() {
  echo "[+] Opening ${PERSIST_DEVICE} as ${MAPPER_NAME}"
  cryptsetup open "${PERSIST_DEVICE}" "${MAPPER_NAME}"
}

make_fs() {
  echo "[+] Creating ext4 filesystem"
  mkfs.ext4 "/dev/mapper/${MAPPER_NAME}"
}

mount_persist() {
  mkdir -p "${MOUNT_POINT}"
  mount "/dev/mapper/${MAPPER_NAME}" "${MOUNT_POINT}"
  mkdir -p "${MOUNT_POINT}/Documents" "${MOUNT_POINT}/Downloads"
}

bind_allowlist() {
  mkdir -p /home/user/Persistent
  mount --bind "${MOUNT_POINT}/Documents" /home/user/Persistent/Documents
  mount --bind "${MOUNT_POINT}/Downloads" /home/user/Persistent/Downloads
}

case "${2:-mount}" in
  init)
    init_luks
    open_luks
    make_fs
    mount_persist
    bind_allowlist
    ;;
  mount)
    open_luks
    mount_persist
    bind_allowlist
    ;;
  *)
    echo "Usage: $0 <device> [init|mount]"
    exit 1
    ;;
esac
