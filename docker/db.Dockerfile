# Usa la imagen oficial de PostgreSQL
FROM docker.io/postgres:14

# Copia los scripts SQL de inicialización
COPY ./init.sql /docker-entrypoint-initdb.d/

# Las variables de entorno para la base de datos se definen en podman-compose.yml
