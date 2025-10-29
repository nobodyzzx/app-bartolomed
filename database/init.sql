-- Nota:
-- El contenedor oficial de Postgres crea automáticamente la base de datos definida
-- en la variable de entorno POSTGRES_DB y ejecuta este archivo .sql dentro de esa
-- misma base de datos. No es necesario (ni válido) usar variables tipo ${...} aquí
-- ni crear/cambiar de base de datos con comandos como CREATE DATABASE o \c.

-- Aquí puedes agregar la creación de extensiones, esquemas, tablas o datos iniciales.
-- Ejemplos (descomenta si los necesitas):
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE SCHEMA IF NOT EXISTS public;
-- CREATE TABLE IF NOT EXISTS users (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   username VARCHAR(50) UNIQUE NOT NULL,
--   email VARCHAR(255) UNIQUE NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- No-op para asegurar que el archivo ejecuta sin errores aunque esté vacío
SELECT 1;