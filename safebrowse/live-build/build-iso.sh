#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
lb clean --purge || true
lb config \
  --architectures amd64 \
  --distribution bookworm \
  --binary-images iso-hybrid \
  --debian-installer false \
  --archive-areas "main contrib non-free non-free-firmware" \
  --bootappend-live "boot=live components quiet splash"
lb build
