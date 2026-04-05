#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Bartolomed — Script de despliegue con creación de SUPER_ADMIN
#  Uso: bash deploy.sh
#  Requisitos: git, docker (o podman), curl, openssl
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${CYAN}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗ ERROR:${NC} $*" >&2; }
sep()  { echo -e "${BLUE}──────────────────────────────────────────────${NC}"; }

# ── Detectar runtime (docker o podman) ───────────────────────────────────────
detect_runtime() {
  if command -v podman &>/dev/null && podman compose version &>/dev/null 2>&1; then
    RUNTIME="podman"; COMPOSE="podman compose"
  elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    RUNTIME="docker"; COMPOSE="docker compose"
  else
    err "No se encontró docker ni podman con soporte compose."
    exit 1
  fi
  ok "Runtime detectado: ${BOLD}$RUNTIME${NC}"
}

# ── Bienvenida ────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║        BARTOLOMED — Despliegue           ║"
echo "  ║   Sistema de Gestión Clínica v1.0        ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

sep
info "Este script desplegará Bartolomed y creará el primer SUPER_ADMIN."
sep
echo ""

# ── 1. Verificar requisitos ───────────────────────────────────────────────────
info "Verificando requisitos..."
for cmd in git curl openssl; do
  command -v "$cmd" &>/dev/null || { err "Falta el comando: $cmd"; exit 1; }
done
detect_runtime
echo ""

# ── 2. Directorio de instalación ─────────────────────────────────────────────
sep
echo -e "${BOLD}Directorio de instalación${NC}"
sep
read -rp "Instalar en [/opt/bartolomed]: " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/opt/bartolomed}"

if [ -d "$INSTALL_DIR/.git" ]; then
  warn "El directorio ya existe. Se actualizará con git pull."
  cd "$INSTALL_DIR"
  git pull origin preproduction 2>/dev/null || git pull origin main 2>/dev/null || true
  ok "Repositorio actualizado."
else
  info "Clonando repositorio en $INSTALL_DIR ..."
  read -rp "URL del repositorio [https://github.com/nobodyzzx/app-bartolomed.git]: " REPO_URL
  REPO_URL="${REPO_URL:-https://github.com/nobodyzzx/app-bartolomed.git}"
  git clone --branch preproduction "$REPO_URL" "$INSTALL_DIR" 2>/dev/null \
    || git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  ok "Repositorio clonado."
fi
echo ""

# ── 3. Configuración de entorno ───────────────────────────────────────────────
sep
echo -e "${BOLD}Configuración del entorno${NC}"
sep

ENV_FILE="$INSTALL_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  warn "Ya existe un archivo .env."
  read -rp "¿Deseas reconfigurarlo? [s/N]: " RECONF
  [[ "${RECONF,,}" != "s" ]] && { info "Usando .env existente."; SKIP_ENV=true; }
fi

if [ "${SKIP_ENV:-false}" = "false" ]; then
  echo ""
  echo -e "${BOLD}Base de datos PostgreSQL${NC}"
  read -rp "  Nombre de la BD [bartolomed]: "         DB_NAME;    DB_NAME="${DB_NAME:-bartolomed}"
  read -rp "  Usuario de BD [med_user]: "             DB_USER;    DB_USER="${DB_USER:-med_user}"
  read -srp " Contraseña de BD: "                     DB_PASS;    echo
  echo ""

  echo -e "${BOLD}Dominio público del frontend${NC}"
  read -rp "  Dominio [bartolomed.tecnocondor.dev]: " FRONTEND_DOMAIN
  FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-bartolomed.tecnocondor.dev}"
  FRONTEND_URL="https://${FRONTEND_DOMAIN}"

  echo ""
  info "Generando secretos JWT y GOD_MODE_TOKEN..."
  JWT_SECRET=$(openssl rand -hex 64)
  JWT_REFRESH_SECRET=$(openssl rand -hex 64)
  GOD_MODE_TOKEN=$(openssl rand -hex 32)

  cat > "$ENV_FILE" <<EOF
# Generado por deploy.sh — $(date '+%Y-%m-%d %H:%M:%S')

POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

GOD_MODE_TOKEN=${GOD_MODE_TOKEN}

FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
FRONTEND_URL=${FRONTEND_URL}
EOF

  chmod 600 "$ENV_FILE"
  ok ".env generado con secretos aleatorios."
fi

# Leer GOD_MODE_TOKEN del .env existente
GOD_MODE_TOKEN=$(grep "^GOD_MODE_TOKEN=" "$ENV_FILE" | cut -d'=' -f2-)
FRONTEND_DOMAIN=$(grep "^FRONTEND_DOMAIN=" "$ENV_FILE" | cut -d'=' -f2-)
echo ""

# ── 4. Levantar contenedores ──────────────────────────────────────────────────
sep
echo -e "${BOLD}Levantando contenedores${NC}"
sep

COMPOSE_FILE="$INSTALL_DIR/docker-compose.dokploy.yml"
[ ! -f "$COMPOSE_FILE" ] && COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"

info "Construyendo imágenes (puede tardar varios minutos la primera vez)..."
$COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache 2>&1 | tail -5

info "Iniciando servicios..."
$COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

ok "Contenedores iniciados."
echo ""

# ── 5. Esperar a que el backend esté listo ────────────────────────────────────
sep
echo -e "${BOLD}Esperando al backend...${NC}"
sep

BACKEND_URL="http://localhost:3000/api/health"
MAX_WAIT=120
WAITED=0

while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    ok "Backend respondiendo (${WAITED}s)."
    break
  fi
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    err "El backend no respondió en ${MAX_WAIT}s."
    info "Revisa los logs con: $COMPOSE -f $COMPOSE_FILE logs backend"
    exit 1
  fi
  printf "  Esperando... %ds\r" "$WAITED"
  sleep 5
  WAITED=$((WAITED + 5))
done
echo ""

# ── 6. Crear SUPER_ADMIN ──────────────────────────────────────────────────────
sep
echo -e "${BOLD}Crear cuenta SUPER_ADMIN${NC}"
sep
echo -e "  ${YELLOW}La contraseña debe tener:${NC} mayúscula, minúscula y al menos un número o símbolo."
echo ""

read -rp "  Email del administrador: "    ADMIN_EMAIL
read -rp "  Nombre [Admin]: "             ADMIN_FIRST; ADMIN_FIRST="${ADMIN_FIRST:-Admin}"
read -rp "  Apellido [Bartolomed]: "      ADMIN_LAST;  ADMIN_LAST="${ADMIN_LAST:-Bartolomed}"
read -srp " Contraseña: "                 ADMIN_PASS;  echo
read -srp " Confirmar contraseña: "       ADMIN_PASS2; echo

if [ "$ADMIN_PASS" != "$ADMIN_PASS2" ]; then
  err "Las contraseñas no coinciden."
  exit 1
fi
echo ""

info "Creando usuario SUPER_ADMIN..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "http://localhost:3000/api/auth/godmode/super-admin" \
  -H "Content-Type: application/json" \
  -H "x-god-token: ${GOD_MODE_TOKEN}" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASS}\",
    \"firstName\": \"${ADMIN_FIRST}\",
    \"lastName\": \"${ADMIN_LAST}\",
    \"mode\": \"create\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  ok "SUPER_ADMIN creado correctamente."
else
  err "No se pudo crear el SUPER_ADMIN (HTTP $HTTP_CODE)."
  echo "  Respuesta: $BODY"
  warn "Puedes intentarlo manualmente más tarde con:"
  echo "  curl -X POST http://localhost:3000/api/auth/godmode/super-admin \\"
  echo "    -H 'x-god-token: ${GOD_MODE_TOKEN}' \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"email\":\"...\",\"password\":\"...\",\"mode\":\"create\"}'"
fi
echo ""

# ── 7. Resumen final ──────────────────────────────────────────────────────────
sep
echo -e "${BOLD}${GREEN}  ✓ Despliegue completado${NC}"
sep
echo ""
echo -e "  ${BOLD}Acceso a la aplicación:${NC}"
echo -e "    Frontend:  ${CYAN}https://${FRONTEND_DOMAIN}${NC}"
echo -e "    API:       ${CYAN}http://localhost:3000/api/health${NC}"
echo ""
echo -e "  ${BOLD}Credenciales del administrador:${NC}"
echo -e "    Email:     ${CYAN}${ADMIN_EMAIL:-<no creado>}${NC}"
echo -e "    Contraseña: la que ingresaste"
echo ""
echo -e "  ${BOLD}Archivo de configuración:${NC} ${CYAN}${ENV_FILE}${NC}"
echo -e "  ${YELLOW}⚠  Guarda el archivo .env en un lugar seguro.${NC}"
echo ""
sep
