# SafeBrowse OS (MVP): Small, Ephemeral, Tor-Forced

This is a practical blueprint for building a **small privacy OS** that:

- routes all network traffic through Tor,
- defaults to **amnesic mode** (everything wiped on shutdown), and
- offers **optional encrypted persistent storage**.

The design is intentionally Linux-based (Debian Live), not a brand-new kernel, so one person can actually ship it.

## 1) Threat model & goals

### Goals
- No accidental clearnet traffic leaks.
- Single-user kiosk UX: boot straight into Tor Browser.
- Ephemeral by default: user activity disappears after power-off.
- Optional encrypted persistence for selected folders.

### Non-goals (MVP)
- Defeating nation-state hardware implants.
- Full remote attestation infrastructure.
- Perfect anonymity against a globally passive adversary.

## 2) System architecture

- **Base image**: Debian Live (read-only squashfs root).
- **Runtime state**: RAM-backed tmpfs overlays.
- **Network control**: nftables kill-switch.
- **Tor transport**: Tor daemon with `TransPort` and `DNSPort`.
- **Browser**: Tor Browser only, launched as unprivileged user.
- **Persistence** (optional): LUKS2 encrypted volume manually unlocked.

High-level data flow:

1. Boot live image -> rootfs mounted read-only.
2. init brings up nftables and tor.
3. systemd verifies tor is healthy.
4. browser launcher starts only if tor active.
5. if tor stops, kill-switch prevents internet access.

## 3) Directory layout for build repo

```
build/
  live-build-config/
    auto/
    config/
      package-lists/safebrowse.list.chroot
      includes.chroot/etc/tor/torrc
      includes.chroot/etc/nftables.conf
      includes.chroot/etc/systemd/system/safebrowse-kiosk.service
      includes.chroot/usr/local/bin/safebrowse-launch
      includes.chroot/usr/local/bin/safebrowse-persist
```

## 4) Package set (minimal)

Install only what is needed:
- `tor`
- `nftables`
- `xorg` / minimal Wayland stack (pick one; example uses X)
- window manager (`openbox`)
- Tor Browser launcher package or bundled tor-browser
- `cryptsetup`
- `haveged` or rng tools (if needed)
- `systemd-timesyncd` (configured not to leak outside Tor; optional in MVP)

## 5) Tor configuration

Use transparent proxy ports and isolate daemon user.

See `torrc.example` in this folder.

## 6) Firewall model (kill-switch)

Policy:
- default drop outbound/inbound/forward.
- allow loopback.
- allow established/related.
- allow **only tor daemon user** to reach clearnet.
- redirect LAN-user TCP -> Tor `TransPort`.
- redirect LAN-user DNS -> Tor `DNSPort`.
- reject all other direct egress.

See `nftables.example.conf`.

## 7) Ephemeral mode (default)

- root filesystem is immutable squashfs.
- `/home`, `/tmp`, browser cache, and logs are in tmpfs.
- disable swap by default.
- journald configured for volatile storage (`Storage=volatile`).

On shutdown, RAM is cleared by power cycle; no local writes retained unless persistence is mounted.

## 8) Optional persistent storage

Provide a helper script that can:
1. initialize a LUKS2 container on selected partition/file,
2. map it at `/dev/mapper/safebrowse-persist`,
3. mount to `/persist`,
4. bind-mount selected directories (for example bookmarks/docs only).

Recommended persist allow-list:
- `/home/user/Persistent/Documents`
- `/home/user/Persistent/Downloads` (optional)
- browser profile backups (optional, off by default)

Do **not** persist:
- system logs,
- `/var/lib/tor`,
- DNS cache,
- package manager metadata.

See `persist-helper.example.sh`.

## 9) Boot UX

- Auto-login into `user` account.
- Launch `safebrowse-launch` service.
- Launcher checks:
  - tor service active,
  - control port health,
  - nftables table loaded.
- If checks fail, show local error screen and keep network blocked.

## 10) Update strategy

- Build signed immutable images.
- A/B image slots (future hardening).
- Offline signature verification before upgrade.

## 11) Verification checklist

Run these tests on each build:
- `curl https://check.torproject.org` from browser should report Tor usage.
- `curl https://example.com` from non-tor user shell should fail.
- DNS leak test should show Tor exit resolver only.
- Kill tor service; verify browser connectivity immediately dies.
- Reboot; verify no prior browsing files in `$HOME`.
- Enable persistence; verify only allow-listed folders survive reboot.

## 12) Limits and next hardening steps

Future steps:
- MAC policy (AppArmor/SELinux) for browser and launcher.
- UEFI Secure Boot custom signing chain.
- Read-only `/boot` verification.
- Hardware clock and time sync anti-fingerprinting strategy.
- Deterministic/reproducible image builds.

---

If you’re implementing this from scratch, start by building and booting once with Tor + nftables + kiosk only, then add persistence as a second milestone.
