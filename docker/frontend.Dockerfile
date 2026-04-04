# Multi-stage build para optimizar la imagen de producción

# Etapa de construcción
FROM node:22-alpine AS builder

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Instala Angular CLI globalmente
RUN npm install -g @angular/cli

# Copia el resto de los archivos del proyecto
COPY . .

# Construye la aplicación para producción
RUN ng build --configuration=production

# Etapa de desarrollo (para desarrollo local)
FROM node:22-alpine AS development
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache chromium && \
    if [ -x /usr/bin/chromium-browser ] && [ ! -e /usr/bin/chromium ]; then ln -s /usr/bin/chromium-browser /usr/bin/chromium; fi
RUN npm install -g @angular/cli

ENV CHROME_BIN=/usr/bin/chromium

# Copiar manifiestos primero (para cache de capas)
COPY package*.json ./

# Instalar dependencias dentro de la imagen (quedan en /app/node_modules de la imagen)
RUN npm install --legacy-peer-deps && npm cache clean --force

# El código fuente se monta vía volumen en runtime; node_modules queda en la imagen
EXPOSE 4200

# Al arrancar: si el volumen sobreescribió node_modules, reinstalar; luego servir
CMD sh -c "[ ! -d node_modules ] && npm install --legacy-peer-deps; npx ng serve --host 0.0.0.0"

# Etapa de producción - usando Node.js para servir archivos estáticos
FROM node:22-alpine AS production

# Instala "serve" para servir archivos estáticos y wget para health checks
RUN npm install -g serve && \
        apk add --no-cache wget

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S angular -u 1001

# Establece el directorio de trabajo
WORKDIR /app

# Copia la aplicación compilada desde la etapa de construcción
COPY --from=builder --chown=angular:nodejs /app/dist/frontend ./

# Verifica la estructura y mueve archivos si es necesario
RUN if [ -d browser ]; then \
            mv browser/* . && rmdir browser; \
        fi && \
        ls -la

# Cambia al usuario no-root
USER angular

# Expone el puerto 4200
EXPOSE 4200

# Comando para servir la aplicación con soporte SPA
CMD ["serve", "-s", ".", "-l", "4200", "--no-clipboard"]
