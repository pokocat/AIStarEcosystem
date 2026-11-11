#!/usr/bin/env bash
set -euo pipefail

# GitHub-hosted runners can reach different Ubuntu mirrors. Select a
# responsive full archive and keep Canonical's archive signature checks.
. /etc/os-release
codename=${VERSION_CODENAME:?}
mirror=
for candidate in \
  https://mirrors.edge.kernel.org/ubuntu \
  https://mirrors.mit.edu/ubuntu \
  https://archive.ubuntu.com/ubuntu \
  https://azure.archive.ubuntu.com/ubuntu
do
  if curl -4 -fsSL --connect-timeout 4 --max-time 8 \
        "$candidate/dists/$codename/InRelease" -o /dev/null &&
     curl -4 -fsSL --connect-timeout 4 --max-time 8 \
        "$candidate/dists/$codename-security/InRelease" -o /dev/null; then
    mirror=$candidate
    break
  fi
done
if [[ -z $mirror ]]; then
  echo 'No reachable Ubuntu package archive' >&2
  exit 1
fi

printf 'Ubuntu package archive %s\n' "$mirror"
sudo tee /etc/apt/sources.list.d/ubuntu.sources >/dev/null <<EOF
Types: deb
URIs: $mirror
Suites: $codename $codename-updates $codename-security
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
sudo install -d -m 755 /var/tmp/aistar-apt-lists
sudo tee /etc/apt/apt.conf.d/99-aistar-ci-network >/dev/null <<'EOF'
Acquire::ForceIPv4 "true";
Acquire::https::Timeout "20";
Dir::State::lists "/var/tmp/aistar-apt-lists/";
#clear APT::Update::Post-Invoke;
#clear APT::Update::Post-Invoke-Success;
EOF
