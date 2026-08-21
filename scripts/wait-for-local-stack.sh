#!/usr/bin/env bash

set -euo pipefail

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://app.localhost:8080/api/ready && \
    curl --fail --silent --show-error http://app.localhost:8080/; then
    exit 0
  fi
  sleep 2
done

docker compose ps
docker compose logs --no-color
exit 1
