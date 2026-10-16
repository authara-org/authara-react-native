#!/usr/bin/env bash
set -euo pipefail

sdk_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sdk_env="${AUTHARA_EXAMPLE_ENV:-$sdk_dir/.env}"
compose_file="$sdk_dir/docker-compose.playground.yaml"
local_compose_file="$sdk_dir/docker-compose.playground.local.yaml"
action="${1:-up}"

if ! test -f "$sdk_env"; then
  echo "The React Native playground environment was not found at $sdk_env." >&2
  echo "Copy $sdk_dir/.env.example to $sdk_dir/.env and fill its local values." >&2
  exit 1
fi

public_url="$(SDK_ENV="$sdk_env" node -e '
  const fs = require("fs");
  const line = fs.readFileSync(process.env.SDK_ENV, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith("AUTHARA_PUBLIC_URL="));
  process.stdout.write((line?.slice("AUTHARA_PUBLIC_URL=".length) || "https://playground.authara.org").replace(/\/$/, ""));
')"
env_core_dir="$(SDK_ENV="$sdk_env" node -e '
  const fs = require("fs");
  const line = fs.readFileSync(process.env.SDK_ENV, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith("AUTHARA_EXAMPLE_CORE_DIR="));
  process.stdout.write(line?.slice("AUTHARA_EXAMPLE_CORE_DIR=".length) || "");
')"
core_dir_input="${AUTHARA_EXAMPLE_CORE_DIR:-$env_core_dir}"

if command -v docker >/dev/null 2>&1; then
  docker_bin="$(command -v docker)"
elif test -x /Applications/Docker.app/Contents/Resources/bin/docker; then
  docker_bin=/Applications/Docker.app/Contents/Resources/bin/docker
elif test -x /usr/local/bin/docker; then
  docker_bin=/usr/local/bin/docker
else
  echo "Docker Desktop is required to run the local Authara stack." >&2
  exit 1
fi

compose=("$docker_bin" compose --env-file "$sdk_env" --project-directory "$sdk_dir" -f "$compose_file")

if test -n "$core_dir_input"; then
  if [[ "$core_dir_input" = /* ]]; then
    core_dir="$core_dir_input"
  else
    core_dir="$sdk_dir/$core_dir_input"
  fi
  core_dir="$(cd "$core_dir" && pwd)"
  if ! test -f "$core_dir/docker/Dockerfile.prod"; then
    echo "Authara Core was not found at $core_dir." >&2
    exit 1
  fi
  export AUTHARA_EXAMPLE_CORE_DIR="$core_dir"
  compose+=( -f "$local_compose_file" )
fi

case "$action" in
  up)
    "${compose[@]}" up -d --build
    gateway_address="$("${compose[@]}" port gateway 3000)"
    gateway_port="${gateway_address##*:}"
    mailpit_address="$("${compose[@]}" port mailpit 8025)"
    mailpit_port="${mailpit_address##*:}"
    local_ready_url="http://127.0.0.1:$gateway_port/auth/ready"
    echo "Waiting for the local Authara gateway and $public_url/auth/ready"
    for _ in {1..60}; do
      if curl --fail --silent --max-time 2 "$local_ready_url" >/dev/null && \
        curl --fail --silent --max-time 2 "$public_url/auth/ready" >/dev/null; then
        echo "Authara is ready through the Cloudflare tunnel."
        echo "Local gateway: http://127.0.0.1:$gateway_port. Mailpit: http://127.0.0.1:$mailpit_port."
        exit 0
      fi
      sleep 1
    done
    echo "The local gateway and public tunnel did not both become ready." >&2
    "${compose[@]}" ps >&2
    exit 1
    ;;
  down)
    "${compose[@]}" down
    ;;
  logs)
    "${compose[@]}" logs --follow authara gateway
    ;;
  *)
    echo "Usage: $0 [up|down|logs]" >&2
    exit 2
    ;;
esac
