#!/bin/sh
# Casos de activos del documento, contra la demo ya levantada.
set -eu

base="${DEMO_URL:-http://localhost:3000}"

user_id() {
  docker compose exec -T postgres psql -U postgres -d buk_authz -tA -c "SELECT id FROM users WHERE name = '$1'"
}

asset_id() {
  docker compose exec -T postgres psql -U postgres -d buk_authz -tA -c "SELECT id FROM assets WHERE name = '$1'"
}

pedro="$(user_id "Pedro")"
carolina="$(user_id "Carolina")"
comercial="$(user_id "Jefe de Gerencia Comercial")"
ti="$(user_id "Jefe de TI")"
notebook="$(asset_id "Notebook Zona Norte")"
telefono="$(asset_id "Teléfono Marketing")"
camioneta="$(asset_id "Camioneta Operaciones")"

status_of() {
  curl -sS -o /tmp/buk-authz-body -w "%{http_code}" "$@"
}

body() {
  cat /tmp/buk-authz-body
}

code="$(status_of -X PATCH "$base/assets/$camioneta" -H "X-User-Id: $pedro" -H "Content-Type: application/json" -d '{"name":"Camioneta Operaciones"}')"
test "$code" = "200"

code="$(status_of -X PATCH "$base/assets/$notebook" -H "X-User-Id: $carolina" -H "Content-Type: application/json" -d '{"name":"No deberia"}')"
test "$code" = "403"
test "$(body)" = '{"error":"denegado"}'

code="$(status_of "$base/assets" -H "X-User-Id: $carolina")"
test "$code" = "200"
test "$(body)" = "[]"

code="$(status_of "$base/assets" -H "X-User-Id: $comercial")"
test "$code" = "200"
printf "%s" "$(body)" | grep -q "\"id\":$notebook"
printf "%s" "$(body)" | grep -q "\"id\":$telefono"
if printf "%s" "$(body)" | grep -q "\"id\":$camioneta"; then
  echo "Gerencia Comercial vio Operaciones" >&2
  exit 1
fi

code="$(status_of -X PATCH "$base/assets/$notebook" -H "X-User-Id: $ti" -H "Content-Type: application/json" -d '{"name":"Notebook Zona Norte"}')"
test "$code" = "200"

code="$(status_of -X PATCH "$base/assets/$camioneta" -H "X-User-Id: $ti" -H "Content-Type: application/json" -d '{"name":"No deberia"}')"
test "$code" = "403"

echo "Casos de la demo en verde"
