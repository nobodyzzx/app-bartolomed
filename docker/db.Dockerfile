# Usa la imagen oficial de PostgreSQL
FROM postgres:14

# Copia los scripts SQL de inicialización
COPY ./init.sql /docker-entrypoint-initdb.d/

# Las variables de entorno para la base de datos se definen en docker-compose.yml