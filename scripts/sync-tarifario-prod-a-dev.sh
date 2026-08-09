#!/usr/bin/env bash
#
# Trae el tarifario de San Bartolomé desde PRODUCCIÓN a la base de DESARROLLO.
#
# Producción pasó a ser la fuente de la verdad del tarifario: allí se ajustan
# los precios reales, se activan servicios y se corrigen nombres. Dev venía de
# las mismas migraciones pero con los precios de arranque, así que probar sobre
# él daba números que no existen.
#
# **No es una migración a propósito.** Una migración correría también en
# producción y allí este script no tiene sentido: escribiría sobre el original.
# Se ejecuta a mano, contra dev, cuando se quiera refrescar.
#
# Qué hace, y qué NO hace:
#   - Actualiza por código los servicios que ya existen en dev (precio, costo,
#     nombre, estado, consentimiento, categoría clínica, entrega).
#   - Da de alta los que existan en producción y falten en dev.
#   - **No borra nada.** Lo que hay en dev y no en producción se queda: son los
#     restos del seed (`LAB-*`), y en dev están referenciados por cargos y por
#     ítems de órdenes de laboratorio. Borrarlos rompería esas referencias.
#   - Solo toca San Bartolomé. San Jorge se deja como está: es la segunda
#     clínica de demostración y sirve para probar el aislamiento entre clínicas.
#
# Uso:  ./scripts/sync-tarifario-prod-a-dev.sh
set -euo pipefail

VPS_ALIAS="${VPS_ALIAS:-nb}"
PROD_DB_CONTAINER="${PROD_DB_CONTAINER:-bartolomed-cayqvm-database-1}"
COMPOSE="${COMPOSE:-podman compose}"
CSV="$(mktemp -t tarifario-prod-XXXXXX.csv)"
trap 'rm -f "$CSV"' EXIT

COLUMNAS='code, name, description, category, lab_category, appointment_type, price, cost_price, turnaround_min_days, turnaround_max_days, turnaround_note, requires_consent, is_active'

echo "→ Exportando el tarifario de producción…"
ssh "$VPS_ALIAS" "docker exec $PROD_DB_CONTAINER sh -c 'psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"\\copy (select $COLUMNAS from service_prices where clinic_id=(select id from clinics where name ilike '\''San Bartolom%'\'') order by code) to stdout with csv\"'" > "$CSV"

FILAS=$(wc -l < "$CSV")
echo "   $FILAS servicios exportados."
if [ "$FILAS" -lt 100 ]; then
  echo "✗ Demasiado pocas filas: el tarifario ronda las 160. Se aborta antes de tocar dev." >&2
  exit 1
fi

echo "→ Aplicando sobre desarrollo…"
# El CSV viaja por la entrada estándar de psql: el cliente corre **dentro** del
# contenedor y no ve los archivos del host, así que un `\copy ... from '<ruta>'`
# no encontraría nada.
{
cat <<SQL
BEGIN;

CREATE TEMP TABLE tarifario_prod (
  code text, name text, description text, category text, lab_category text,
  appointment_type text, price numeric(10,2), cost_price numeric(10,2),
  turnaround_min_days smallint, turnaround_max_days smallint, turnaround_note text,
  requires_consent boolean, is_active boolean
) ON COMMIT DROP;

\copy tarifario_prod ($COLUMNAS) from stdin with csv
SQL
cat "$CSV"
echo '\.'
cat <<SQL

CREATE TEMP TABLE destino ON COMMIT DROP AS
  SELECT id FROM clinics WHERE name = 'San Bartolomé';

UPDATE service_prices sp SET
  name = p.name,
  description = p.description,
  lab_category = p.lab_category,
  appointment_type = p.appointment_type::service_prices_appointment_type_enum,
  price = p.price,
  cost_price = p.cost_price,
  turnaround_min_days = p.turnaround_min_days,
  turnaround_max_days = p.turnaround_max_days,
  turnaround_note = p.turnaround_note,
  requires_consent = p.requires_consent,
  is_active = p.is_active
FROM tarifario_prod p
WHERE sp.code = p.code
  AND sp.clinic_id = (SELECT id FROM destino);

INSERT INTO service_prices
  ($COLUMNAS, clinic_id)
SELECT p.code, p.name, p.description, p.category::service_prices_category_enum, p.lab_category,
       p.appointment_type::service_prices_appointment_type_enum, p.price, p.cost_price,
       p.turnaround_min_days, p.turnaround_max_days, p.turnaround_note,
       p.requires_consent, p.is_active, (SELECT id FROM destino)
FROM tarifario_prod p
WHERE NOT EXISTS (
  SELECT 1 FROM service_prices sp
  WHERE sp.code = p.code AND sp.clinic_id = (SELECT id FROM destino)
);

COMMIT;
SQL
} | $COMPOSE exec -T db psql -U med_user -d bartolomed -v ON_ERROR_STOP=1

echo "→ Comprobación:"
$COMPOSE exec -T db psql -U med_user -d bartolomed -c "
  select count(*) as en_dev,
         count(*) filter (where is_active) as activos,
         count(*) filter (where price = 0) as sin_precio
  from service_prices
  where clinic_id = (select id from clinics where name = 'San Bartolomé');"

echo "✔ Listo."
