#!/usr/bin/env bash
# Applies all migrations to a throwaway Supabase Postgres container and runs
# the SQL integration tests in tests/db. Requires Docker.
set -euo pipefail

IMAGE="${SUPABASE_PG_IMAGE:-supabase/postgres:17.11.0.006}"
NAME="gipse-db-test-$$"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Starting $IMAGE…"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null

until docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 1; done
# The image runs its own init migrations after the server first accepts connections.
until docker exec "$NAME" psql -U supabase_admin -d postgres -tAc "select 1 from pg_roles where rolname = 'service_role'" 2>/dev/null | grep -q 1; do sleep 1; done
sleep 2

run_sql() {
  docker exec -i "$NAME" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -X < "$1"
}

run_sql "$ROOT/tests/db/00_storage_stub.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  run_sql "$migration"
done

for test in "$ROOT"/tests/db/*.test.sql; do
  echo "Running $(basename "$test")"
  run_sql "$test"
done
