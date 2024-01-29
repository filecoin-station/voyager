#!/usr/bin/env bash
set -e
VOYAGER_VERSION="$1"
git tag -s v"$VOYAGER_VERSION" -m v"$VOYAGER_VERSION"
git push
git push origin v"$VOYAGER_VERSION"
