#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-$REPO_ROOT/config/pi-image.env}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "run with sudo: sudo $0 $ENV_FILE"
}

ensure_vfat_mount_support() {
  if grep -qw vfat /proc/filesystems; then
    return
  fi

  if command -v modprobe >/dev/null 2>&1 && modprobe vfat >/dev/null 2>&1 && grep -qw vfat /proc/filesystems; then
    return
  fi

  die "host cannot mount vfat boot partitions. Enable the vfat kernel module or run this on a Linux host with FAT filesystem support."
}

load_config() {
  [[ -f "$ENV_FILE" ]] || die "missing config file: $ENV_FILE. Copy config/pi-image.env.example first."
  # shellcheck disable=SC1090
  source "$ENV_FILE"

  : "${PI_IMAGE_URL:?PI_IMAGE_URL is required}"
  : "${PI_HOSTNAME:?PI_HOSTNAME is required}"
  : "${PI_USERNAME:?PI_USERNAME is required}"
  : "${PI_APP_DIR:?PI_APP_DIR is required}"

  PI_IMAGE_SHA256="${PI_IMAGE_SHA256:-}"
  PI_PASSWORD="${PI_PASSWORD:-}"
  PI_PASSWORD_HASH="${PI_PASSWORD_HASH:-}"
  PI_SSH_PUBLIC_KEY="${PI_SSH_PUBLIC_KEY:-}"
  PI_WIFI_COUNTRY="${PI_WIFI_COUNTRY:-US}"
  PI_WIFI_SSID="${PI_WIFI_SSID:-}"
  PI_WIFI_PASSWORD="${PI_WIFI_PASSWORD:-}"
  PI_TIMEZONE="${PI_TIMEZONE:-UTC}"
  PI_LOCALE="${PI_LOCALE:-en_US.UTF-8}"
  PI_EXTRA_IMAGE_MB="${PI_EXTRA_IMAGE_MB:-1024}"

  [[ "$PI_USERNAME" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || die "PI_USERNAME is not a valid Linux username"
  [[ "$PI_HOSTNAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$ ]] || die "PI_HOSTNAME is not a valid hostname"
  [[ "$PI_APP_DIR" = /* ]] || die "PI_APP_DIR must be an absolute path"
}

write_env_var() {
  local key="$1"
  local value="$2"
  printf '%s=%q\n' "$key" "$value"
}

cleanup() {
  set +e
  if [[ -n "${ROOT_MOUNT:-}" ]] && mountpoint -q "$ROOT_MOUNT/boot/firmware"; then
    umount "$ROOT_MOUNT/boot/firmware"
  fi
  if [[ -n "${BOOT_MOUNT:-}" ]] && mountpoint -q "$BOOT_MOUNT"; then
    umount "$BOOT_MOUNT"
  fi
  if [[ -n "${ROOT_MOUNT:-}" ]] && mountpoint -q "$ROOT_MOUNT"; then
    umount "$ROOT_MOUNT"
  fi
  if [[ -n "${LOOPDEV:-}" ]]; then
    partx --delete "$LOOPDEV" >/dev/null 2>&1 || true
    losetup -d "$LOOPDEV"
  fi
}

download_image() {
  local image_name compressed

  image_name="$(basename "${PI_IMAGE_URL%%\?*}")"
  compressed="$DOWNLOAD_DIR/$image_name"

  if [[ ! -f "$compressed" ]]; then
    printf 'Downloading %s\n' "$PI_IMAGE_URL"
    curl -L --fail --output "$compressed" "$PI_IMAGE_URL"
  fi

  if [[ -n "$PI_IMAGE_SHA256" ]]; then
    printf '%s  %s\n' "$PI_IMAGE_SHA256" "$compressed" | sha256sum -c -
  else
    printf 'Skipping checksum verification because PI_IMAGE_SHA256 is empty.\n'
  fi

  RAW_IMAGE="$WORK_DIR/${image_name%.xz}"
  if [[ "$image_name" = *.xz ]]; then
    xz -dkc "$compressed" >"$RAW_IMAGE"
  else
    cp "$compressed" "$RAW_IMAGE"
  fi

  if [[ "$PI_EXTRA_IMAGE_MB" =~ ^[0-9]+$ ]] && [[ "$PI_EXTRA_IMAGE_MB" -gt 0 ]]; then
    truncate -s +"${PI_EXTRA_IMAGE_MB}M" "$RAW_IMAGE"
  fi
}

partition_value() {
  local partition_number="$1"
  local field="$2"

  partx --pairs "$RAW_IMAGE" \
    | sed -n "s/^NR=\"$partition_number\" .*${field}=\"\\([0-9][0-9]*\\)\".*/\\1/p" \
    | sed -n '1p'
}

mount_partition_by_offset() {
  local partition_number="$1"
  local mount_point="$2"
  local start_sector sectors offset_bytes size_bytes

  start_sector="$(partition_value "$partition_number" START)"
  sectors="$(partition_value "$partition_number" SECTORS)"
  [[ -n "$start_sector" ]] || die "could not read START for partition $partition_number"
  [[ -n "$sectors" ]] || die "could not read SECTORS for partition $partition_number"

  offset_bytes=$((start_sector * 512))
  size_bytes=$((sectors * 512))
  mount -o "loop,offset=$offset_bytes,sizelimit=$size_bytes" "$RAW_IMAGE" "$mount_point" || return 1
}

mount_image() {
  LOOPDEV="$(losetup --find --show "$RAW_IMAGE")" || return 1
  partx --add "$LOOPDEV" || return 1
  if command -v udevadm >/dev/null 2>&1; then
    udevadm settle
  fi

  local boot_part="" root_part=""
  for _ in {1..50}; do
    if [[ -b "${LOOPDEV}p1" ]]; then
      boot_part="${LOOPDEV}p1"
      root_part="${LOOPDEV}p2"
      break
    fi
    if [[ -b "${LOOPDEV}1" ]]; then
      boot_part="${LOOPDEV}1"
      root_part="${LOOPDEV}2"
      break
    fi
    sleep 0.1
  done

  [[ -b "$boot_part" ]] || return 1
  [[ -b "$root_part" ]] || return 1

  mount "$root_part" "$ROOT_MOUNT" || return 1
  mount "$boot_part" "$BOOT_MOUNT" || return 1
}

mount_image_with_fallback() {
  if mount_image; then
    return
  fi

  printf 'Falling back to offset-based partition mounts.\n'
  cleanup
  LOOPDEV=""
  mount_partition_by_offset 2 "$ROOT_MOUNT" || die "could not mount root partition from $RAW_IMAGE"
  mount_partition_by_offset 1 "$BOOT_MOUNT" || die "could not mount boot partition from $RAW_IMAGE"
}

install_repo() {
  mkdir -p "$ROOT_MOUNT$PI_APP_DIR"
  tar \
    --exclude='./.git' \
    --exclude='./.pi-build' \
    --exclude='./dist' \
    --exclude='./config/pi-image.env' \
    -C "$REPO_ROOT" \
    -cf - . | tar -C "$ROOT_MOUNT$PI_APP_DIR" -xf -
}

configure_boot() {
  local password_hash

  touch "$BOOT_MOUNT/ssh"

  if [[ -n "$PI_PASSWORD_HASH" ]]; then
    password_hash="$PI_PASSWORD_HASH"
  elif [[ -n "$PI_PASSWORD" ]]; then
    password_hash="$(openssl passwd -6 "$PI_PASSWORD")"
  else
    die "set PI_PASSWORD or PI_PASSWORD_HASH so Raspberry Pi OS can create the first user"
  fi

  printf '%s:%s\n' "$PI_USERNAME" "$password_hash" >"$BOOT_MOUNT/userconf.txt"
  chmod 0600 "$BOOT_MOUNT/userconf.txt"
}

install_firstboot() {
  install -d -m 0755 "$ROOT_MOUNT/etc/telegramtestone"
  {
    write_env_var PI_HOSTNAME "$PI_HOSTNAME"
    write_env_var PI_USERNAME "$PI_USERNAME"
    write_env_var PI_SSH_PUBLIC_KEY "$PI_SSH_PUBLIC_KEY"
    write_env_var PI_WIFI_COUNTRY "$PI_WIFI_COUNTRY"
    write_env_var PI_WIFI_SSID "$PI_WIFI_SSID"
    write_env_var PI_WIFI_PASSWORD "$PI_WIFI_PASSWORD"
    write_env_var PI_TIMEZONE "$PI_TIMEZONE"
    write_env_var PI_LOCALE "$PI_LOCALE"
    write_env_var PI_APP_DIR "$PI_APP_DIR"
  } >"$ROOT_MOUNT/etc/telegramtestone/pi.env"
  chmod 0600 "$ROOT_MOUNT/etc/telegramtestone/pi.env"

  install -d -m 0755 "$ROOT_MOUNT/usr/local/sbin"
  cat >"$ROOT_MOUNT/usr/local/sbin/telegramtestone-firstboot.sh" <<'FIRSTBOOT'
#!/usr/bin/env bash
set -euo pipefail

MARKER="/var/lib/telegramtestone/firstboot.done"
ENV_FILE="/etc/telegramtestone/pi.env"

log() {
  printf '[telegramtestone-firstboot] %s\n' "$*"
}

[[ ! -f "$MARKER" ]] || exit 0
[[ -f "$ENV_FILE" ]] || {
  log "missing $ENV_FILE"
  exit 1
}

# shellcheck disable=SC1090
source "$ENV_FILE"

install -d -m 0755 /var/lib/telegramtestone

if command -v hostnamectl >/dev/null 2>&1; then
  hostnamectl set-hostname "$PI_HOSTNAME" || true
else
  printf '%s\n' "$PI_HOSTNAME" >/etc/hostname
fi

if grep -q '^127\.0\.1\.1' /etc/hosts; then
  sed -i "s/^127\.0\.1\.1.*/127.0.1.1\t$PI_HOSTNAME/" /etc/hosts
else
  printf '127.0.1.1\t%s\n' "$PI_HOSTNAME" >>/etc/hosts
fi

if [[ -n "${PI_TIMEZONE:-}" ]] && command -v timedatectl >/dev/null 2>&1; then
  timedatectl set-timezone "$PI_TIMEZONE" || true
fi

if [[ -n "${PI_LOCALE:-}" ]] && [[ -f /etc/locale.gen ]] && command -v locale-gen >/dev/null 2>&1; then
  sed -i "s/^# *${PI_LOCALE} UTF-8/${PI_LOCALE} UTF-8/" /etc/locale.gen
  locale-gen "$PI_LOCALE" || true
  update-locale "LANG=$PI_LOCALE" || true
fi

if apt-get update; then
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv || true
else
  log "apt update failed; skipping package installation"
fi

if id "$PI_USERNAME" >/dev/null 2>&1; then
  HOME_DIR="$(getent passwd "$PI_USERNAME" | cut -d: -f6)"
  if [[ -n "${PI_SSH_PUBLIC_KEY:-}" ]]; then
    install -d -m 0700 -o "$PI_USERNAME" -g "$PI_USERNAME" "$HOME_DIR/.ssh"
    printf '%s\n' "$PI_SSH_PUBLIC_KEY" >"$HOME_DIR/.ssh/authorized_keys"
    chown "$PI_USERNAME:$PI_USERNAME" "$HOME_DIR/.ssh/authorized_keys"
    chmod 0600 "$HOME_DIR/.ssh/authorized_keys"
  fi

  if [[ -d "$PI_APP_DIR" ]]; then
    chown -R "$PI_USERNAME:$PI_USERNAME" "$PI_APP_DIR"
  fi
fi

if [[ -n "${PI_WIFI_SSID:-}" ]] && [[ -n "${PI_WIFI_PASSWORD:-}" ]] && command -v nmcli >/dev/null 2>&1; then
  nmcli radio wifi on || true
  if ! nmcli --terse --fields NAME connection show | grep -Fxq "$PI_WIFI_SSID"; then
    nmcli connection add type wifi ifname wlan0 con-name "$PI_WIFI_SSID" ssid "$PI_WIFI_SSID" || true
  fi
  nmcli connection modify "$PI_WIFI_SSID" \
    wifi-sec.key-mgmt wpa-psk \
    wifi-sec.psk "$PI_WIFI_PASSWORD" \
    802-11-wireless.country "${PI_WIFI_COUNTRY:-US}" || true
  nmcli connection up "$PI_WIFI_SSID" || true
fi

touch "$MARKER"
systemctl disable telegramtestone-firstboot.service >/dev/null 2>&1 || true
log "complete"
FIRSTBOOT
  chmod 0755 "$ROOT_MOUNT/usr/local/sbin/telegramtestone-firstboot.sh"

  cat >"$ROOT_MOUNT/etc/systemd/system/telegramtestone-firstboot.service" <<'SERVICE'
[Unit]
Description=telegramTestOne first boot setup
ConditionPathExists=!/var/lib/telegramtestone/firstboot.done
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/telegramtestone-firstboot.sh
TimeoutStartSec=5min

[Install]
WantedBy=multi-user.target
SERVICE

  install -d -m 0755 "$ROOT_MOUNT/etc/systemd/system/multi-user.target.wants"
  ln -sf ../telegramtestone-firstboot.service \
    "$ROOT_MOUNT/etc/systemd/system/multi-user.target.wants/telegramtestone-firstboot.service"
}

finalize_image() {
  local output
  output="$DIST_DIR/telegramtestone-rpi4-$(date -u +%Y%m%d%H%M%S).img"
  cp "$RAW_IMAGE" "$output"
  printf 'Image ready: %s\n' "$output"
}

main() {
  require_root
  require_cmd curl
  require_cmd grep
  require_cmd losetup
  require_cmd mount
  require_cmd mountpoint
  require_cmd openssl
  require_cmd partx
  require_cmd sed
  require_cmd sha256sum
  require_cmd tar
  require_cmd truncate
  require_cmd xz
  load_config

  BUILD_DIR="$REPO_ROOT/.pi-build"
  DOWNLOAD_DIR="$BUILD_DIR/downloads"
  WORK_DIR="$BUILD_DIR/work"
  DIST_DIR="$REPO_ROOT/dist"
  ROOT_MOUNT="$BUILD_DIR/mnt/root"
  BOOT_MOUNT="$BUILD_DIR/mnt/boot"

  mkdir -p "$DOWNLOAD_DIR" "$WORK_DIR" "$DIST_DIR" "$ROOT_MOUNT" "$BOOT_MOUNT"
  trap cleanup EXIT

  ensure_vfat_mount_support
  download_image
  mount_image_with_fallback
  install_repo
  configure_boot
  install_firstboot
  cleanup
  trap - EXIT
  finalize_image
}

main "$@"
