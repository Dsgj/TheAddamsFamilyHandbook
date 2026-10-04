#!/bin/sh
# Smoke test of the nginx image (audit TT2-10): builds it under a sub-path, runs it, and checks
# what it serves and how it caches. CI runs it with docker; locally podman works the same.
#
#   sh scripts/docker-smoke.sh [docker|podman]
set -eu
# Git Bash would rewrite /sub/ into a Windows path on its way to a native docker or podman.
export MSYS_NO_PATHCONV=1

ENGINE=${1:-docker}
BASE=/sub/
PORT=${PORT:-8089}
TAG=valvet-smoke

"$ENGINE" build --build-arg BASE_PATH=$BASE -t $TAG .
id=$("$ENGINE" run -d -p "$PORT:80" $TAG)
trap '"$ENGINE" rm -f "$id" >/dev/null' EXIT
url=http://localhost:$PORT$BASE

i=0
until curl -fs -o /dev/null "$url"; do
  i=$((i + 1))
  [ $i -lt 30 ] || { echo "nginx did not answer on $url"; exit 1; }
  sleep 1
done

fail=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
cache() { curl -sI "$1" | tr -d '\r' | sed -n 's/^[Cc]ache-[Cc]ontrol: //p' | tail -1; }
expect_code() { # url, code
  got=$(code "$1")
  if [ "$got" = "$2" ]; then ok "$2 $1"; else bad "$1 answered $got, not $2"; fi
}
expect_cache() { # url, Cache-Control
  got=$(cache "$1")
  if [ "$got" = "$2" ]; then ok "$1: $2"; else bad "$1 has Cache-Control '$got', not '$2'"; fi
}

expect_code "$url" 200
expect_code "${url}tables" 200
expect_code "${url}manual/ops/25" 200
expect_code "${url}nope" 404
if curl -s "${url}nope" | grep -q '<title>'; then ok "the 404 is the app's page"; else bad "the 404 is not the app's page"; fi

css=$(curl -s "$url" | grep -o "${BASE}_astro/[^\"]*\.css" | head -1)
if [ -n "$css" ]; then
  expect_cache "http://localhost:$PORT$css" "public, max-age=31536000, immutable"
else
  bad "no hashed stylesheet under ${BASE}_astro/ in the home page"
fi
expect_cache "${url}brand/logo.webp" "public, max-age=86400"
expect_cache "${url}sw.js" "no-cache"

if curl -sI -H 'Accept-Encoding: gzip' "$url" | tr -d '\r' | grep -qi '^content-encoding: gzip'; then
  ok "the page is gzipped"
else
  bad "the page is not gzipped"
fi

exit $fail
