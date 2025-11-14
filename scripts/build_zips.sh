#!/usr/bin/env bash
set -euo pipefail

mkdir -p infra/zips

zip_fn () {
  local dir="$1"
  local name="$2"
  (cd "app/$dir" && zip -qr "../../infra/zips/${name}.zip" .)
  echo "Built infra/zips/${name}.zip"
}

zip_fn lib lib           # include shared libs with each lambda via layer? -> simpler: embed lib inside zips below
# We’ll just include lib within each zip by copying it prior to zipping:
tmpdir="$(mktemp -d)"
embed_zip () {
  local src="$1" name="$2"
  rm -rf "$tmpdir" && mkdir -p "$tmpdir"
  cp -r "app/$src/"* "$tmpdir"/
  mkdir -p "$tmpdir/../lib"
  cp -r app/lib "$tmpdir/"
  (cd "$tmpdir" && zip -qr "../infra/zips/${name}.zip" .)
  echo "Built infra/zips/${name}.zip (with lib/)"
}
embed_zip ingest ingest
embed_zip persist persist
embed_zip worker worker
embed_zip get-flight get-flight

rm -rf "$tmpdir"
