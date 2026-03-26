#!/usr/bin/env bash

set -euo pipefail

source .buildkite/scripts/common/util.sh

if [[ -d .moon/cache ]]; then
  du -h .moon/cache
fi

echo "--- Clear moon cache"
rm -rf .moon/cache

export MOON_CACHE=write
.buildkite/scripts/bootstrap.sh

echo "--- Archive moon cache"
if [[ ! -d .moon/cache ]]; then
  echo "No moon cache directory found, skipping archive"
  exit 0
else
  du -h .moon/cache
  du -h .moon/cache/outputs

  node .buildkite/scripts/steps/processMoonCache.cjs .moon/cache || echo "Failed to process moon cache"

  echo "--- Archive moon cache"
  tar -czf ~/moon-cache.tar.gz .moon/cache || echo "Failed to archive moon cache"
  cd ~/
  buildkite-agent artifact upload moon-cache.tar.gz || echo "Failed to upload moon cache"
  echo "Moon cache archived as moon-cache.tar.gz"
fi
