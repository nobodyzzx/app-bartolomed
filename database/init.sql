CREATE DATABASE ${POSTGRES_DB};
\c myapp;

-- Aquí puedes agregar la creación de tablas o datos iniciales si lo deseas
-- Por ejemplo:
-- CREATE TABLE users (
--     id SERIAL PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );