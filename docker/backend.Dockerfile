# Multi-stage build para optimizar la imagen de producción

# Etapa de construcción
FROM node:22-slim AS builder

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala TODAS las dependencias (incluyendo devDependencies para construir)
RUN npm ci && npm cache clean --force

# Copia el resto de los archivos del proyecto
COPY . .

# Compila la aplicación
RUN npm run build

# Verificar que dist existe
RUN ls -la /app/dist && echo "Build successful - dist folder exists"

# Etapa de desarrollo
FROM node:22-slim AS development
RUN apt-get update && apt-get install -y --no-install-recommends \
    procps \
    ca-certificates \
    curl \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*
# Typst: único motor de generación de PDF (Puppeteer/Chromium retirado por
# completo — ver backend/src/pdf/, migración cerrada en Fase 3). Solo hay
# release "musl" para x86_64 — es estático, no depende de glibc en runtime,
# corre igual en esta imagen Debian.
ARG TYPST_VERSION=0.15.1
RUN curl -sL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
    && tar -xf /tmp/typst.tar.xz -C /tmp \
    && mv "/tmp/typst-x86_64-unknown-linux-musl/typst" /usr/local/bin/typst \
    && rm -rf /tmp/typst* \
    && typst --version
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g @nestjs/cli
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Etapa de producción
FROM node:22-slim AS production

# Instala dumb-init para manejo de señales y wget para health checks (usar apt en vez de apk)
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init wget ca-certificates curl xz-utils && \
    rm -rf /var/lib/apt/lists/*

# Typst: único motor de generación de PDF (Puppeteer/Chromium retirado por
# completo — ver backend/src/pdf/, migración cerrada en Fase 3). Solo hay
# release "musl" para x86_64 — es estático, no depende de glibc en runtime,
# corre igual en esta imagen Debian. curl/xz-utils se purgan después de
# extraer el binario, ya no hacen falta en runtime.
ARG TYPST_VERSION=0.15.1
RUN curl -sL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
    && tar -xf /tmp/typst.tar.xz -C /tmp \
    && mv "/tmp/typst-x86_64-unknown-linux-musl/typst" /usr/local/bin/typst \
    && rm -rf /tmp/typst* \
    && typst --version \
    && apt-get purge -y curl xz-utils && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN groupadd -g 1001 nodejs || true
RUN useradd -u 1001 -r -g nodejs -s /usr/sbin/nologin nestjs || true

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala solo las dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copia la aplicación compilada desde la etapa de construcción
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
# Bug real encontrado al tocar este Dockerfile: nunca se copiaba public/ a
# producción — el logo de los PDF (public/images/logo.png) fallaba en
# silencio (try/catch en cada *-pdf.service.ts) y nunca salía en producción.
# public/pdf/ también es donde viven las plantillas .typ y fuentes nuevas.
COPY --from=builder --chown=nestjs:nodejs /app/public ./public

# Verificar que dist/main.js existe
RUN ls -la /app/dist/ && test -f /app/dist/main.js && echo "main.js found"

# Crea el directorio de uploads con permisos para el usuario nestjs
RUN mkdir -p /app/uploads/consent-forms && \
    chown -R nestjs:nodejs /app/uploads

# Directorio de trabajo de Typst (entradas .typ temporales + PNGs de charts
# rasterizados) — debe vivir bajo el --root que se le pasa a `typst compile`
# (public/pdf/), Typst no puede leer/escribir fuera de su --root.
RUN mkdir -p /app/public/pdf/.tmp && \
    chown -R nestjs:nodejs /app/public/pdf/.tmp

# Cambia al usuario no-root
USER nestjs

# Expone el puerto 3000
EXPOSE 3000

# Comando para iniciar la aplicación en modo de producción
# Corre migraciones pendientes antes de arrancar
CMD ["dumb-init", "sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js && node dist/main"]
