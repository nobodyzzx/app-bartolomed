# Usa la imagen oficial de PostgreSQL (variante Debian para minimizar vulnerabilidades conocidas en Alpine)
FROM docker.io/postgres:17.2-bookworm

# Seguridad: confiar en la imagen oficial parchada y evitar 'apt-get upgrade' dentro del contenedor
# Esto reduce superficie de paquetes y CVEs; actualiza vulnerabilidades con 'docker pull' del tag base

# Copia los scripts SQL de inicialización
COPY ./init.sql /docker-entrypoint-initdb.d/

# Las variables de entorno para la base de datos se definen en podman-compose.yml
