#!/usr/bin/env bash
# Simulate CloudTAK Docker web build gate for this plugin:
#   npm run lint && npm run check && npm run build  (from api/web, no plugin node_modules)
#
# Host eslint/vue-tsc can skip symlinked plugin directories. When plugins/<slug> is a
# symlink, this script copies into a temporary real directory for the gate.
set -euo pipefail

WEB="${1:-$HOME/CloudTAK/api/web}"
PLUGIN_SLUG="${PLUGIN_SLUG:-measure}"
PLUGIN_DIR="plugins/${PLUGIN_SLUG}"
PLUGIN_PATH="$WEB/$PLUGIN_DIR"
PLUGIN_NM="$PLUGIN_PATH/node_modules"
BACKUP=""
CHECK_SLUG=""
CHECK_DIR=""

cleanup() {
  if [[ -n "$BACKUP" && -d "$BACKUP/node_modules" ]]; then
    mkdir -p "$(dirname "$PLUGIN_NM")"
    mv "$BACKUP/node_modules" "$PLUGIN_NM"
    rmdir "$BACKUP" 2>/dev/null || true
  fi
  if [[ -n "$CHECK_DIR" && -d "$CHECK_DIR" ]]; then
    rm -rf "$CHECK_DIR"
  fi
}
trap cleanup EXIT

if [[ ! -e "$PLUGIN_PATH" ]]; then
  echo "Plugin not found: $PLUGIN_PATH" >&2
  echo "Symlink with: ln -sfn <repo> $PLUGIN_PATH" >&2
  exit 1
fi

TARGET_DIR="$PLUGIN_DIR"

if [[ -L "$PLUGIN_PATH" ]]; then
  CHECK_SLUG="_${PLUGIN_SLUG}check"
  CHECK_DIR="$WEB/plugins/$CHECK_SLUG"
  rm -rf "$CHECK_DIR"
  rsync -a --exclude node_modules --exclude .git --exclude package-lock.json \
    "$PLUGIN_PATH/" "$CHECK_DIR/"
  rm -rf "$CHECK_DIR/node_modules"
  TARGET_DIR="plugins/$CHECK_SLUG"
  echo "==> using real copy $TARGET_DIR (symlink skipped by host tools)"
fi

if [[ -d "$PLUGIN_NM" ]]; then
  BACKUP="$(mktemp -d)"
  mv "$PLUGIN_NM" "$BACKUP/node_modules"
fi

cd "$WEB"

echo "==> eslint $TARGET_DIR"
npx eslint --config eslint.config.js "./$TARGET_DIR/"

echo "==> vue-tsc (host check; fail only on $TARGET_DIR errors)"
set +e
npm run check 2>&1 | tee /tmp/cloudtak-check.log
set -e
if grep -q "${TARGET_DIR}/" /tmp/cloudtak-check.log; then
  echo >&2
  echo "${PLUGIN_SLUG} vue-tsc errors — fix types or ensure deps come from api/web package.json:" >&2
  grep "${TARGET_DIR}/" /tmp/cloudtak-check.log >&2
  exit 1
fi

echo "==> vite build"
npm run build

echo "check passed (eslint + no ${TARGET_DIR}/ vue-tsc errors + build)"
