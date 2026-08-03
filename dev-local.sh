#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

exec pnpm --dir "$ROOT_DIR/web" dev
