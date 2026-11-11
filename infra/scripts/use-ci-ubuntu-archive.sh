#!/usr/bin/env bash
set -euo pipefail

# Hosted Ubuntu uses a mirror+file URI on newer images. Update the mirror
# list as well as direct source definitions and retain Ubuntu's signing keys.
for source in /etc/apt/apt-mirrors.txt /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
  if [[ -f "$source" ]]; then
    sudo sed -E -i 's|https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$source"
  fi
done
