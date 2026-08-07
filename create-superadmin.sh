#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
#  Bartolomed — Crear SUPER_ADMIN
#  Solo necesita: bash + curl
# ══════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()  { echo -e "${GREEN}✓${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*"; }

clear
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Bartolomed — Crear SUPER_ADMIN     ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── Parámetros ──────────────────────────────────────
API="${1:-https://bartolomed.tecnocondor.dev/api}"

read -rp  "  Email:            " EMAIL
read -rp  "  Nombre:           " FIRST
read -rp  "  Apellido:         " LAST
read -srp " Contraseña:        " PASS;  echo
read -srp " Confirmar:         " PASS2; echo
read -srp " GOD_MODE_TOKEN:    " TOKEN; echo
echo ""

if [ "$PASS" != "$PASS2" ]; then
  err "Las contraseñas no coinciden."; exit 1
fi

echo -e "  Conectando a ${CYAN}${API}${NC}..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${API}/auth/godmode/super-admin" \
  -H "Content-Type: application/json" \
  -H "x-god-token: ${TOKEN}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"firstName\":\"${FIRST}\",\"lastName\":\"${LAST}\",\"mode\":\"create\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo ""
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  ok "SUPER_ADMIN creado: ${BOLD}${EMAIL}${NC}"
else
  err "Error HTTP $HTTP_CODE"
  echo "  $BODY"
fi
