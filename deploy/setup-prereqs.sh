#!/usr/bin/env bash
# One-time host setup for the CloudNSofts VM (Ubuntu 24.04): Docker, Node 20,
# nginx, pm2. Idempotent — safe to re-run. Requires sudo.
set -euo pipefail

echo "== apt base packages =="
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  nginx rsync ca-certificates curl gnupg openssl

echo "== Node 20 (NodeSource) =="
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
fi
node -v && npm -v

echo "== Docker Engine + Compose plugin =="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER" || true   # log out/in for group to take effect
docker --version && docker compose version

echo "== pm2 (process manager) =="
sudo npm install -g pm2
pm2 -v

echo "== DONE. If 'docker' still needs sudo, re-login so the docker group applies. =="
