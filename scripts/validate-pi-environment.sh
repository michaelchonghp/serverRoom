#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf 'Validating shell scripts...\n'
bash -n "$REPO_ROOT/scripts/build-pi-sd-image.sh"
bash -n "$REPO_ROOT/scripts/validate-pi-environment.sh"

printf 'Validating required files...\n'
test -f "$REPO_ROOT/config/pi-image.env.example"
test -f "$REPO_ROOT/docker/pi-dev/Dockerfile"
test -f "$REPO_ROOT/Makefile"

printf 'Validating example config can be sourced...\n'
(
  set -euo pipefail
  # shellcheck disable=SC1091
  source "$REPO_ROOT/config/pi-image.env.example"
  : "${PI_IMAGE_URL:?}"
  : "${PI_HOSTNAME:?}"
  : "${PI_USERNAME:?}"
  : "${PI_APP_DIR:?}"
)

printf 'OK\n'
