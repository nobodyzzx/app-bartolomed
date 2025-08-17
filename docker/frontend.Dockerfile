# Multi-stage build para optimizar la imagen de producción

# Etapa de construcción
FROM node:20-alpine AS builder

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm ci && npm cache clean --force

# Instala Angular CLI globalmente
RUN npm install -g @angular/cli

# Copia el resto de los archivos del proyecto
COPY . .

# Construye la aplicación para producción
RUN ng build --configuration=production

# Etapa de desarrollo (para desarrollo local)
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g @angular/cli
COPY . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]

# Etapa de producción - usando Node.js para servir archivos estáticos
FROM node:20-alpine AS production

# Instala serve para servir archivos estáticos y wget para health checks
RUN npm install -g serve && \
    apk add --no-cache wget

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S angular -u 1001

# Establece el directorio de trabajo
WORKDIR /app

# Copia la aplicación compilada desde la etapa de construcción directamente
COPY --from=builder --chown=angular:nodejs /app/dist/frontend .

# Cambia al usuario no-root
USER angular

# Expone el puerto 4200
EXPOSE 4200

# Comando para servir la aplicación estática con soporte para SPA (desde el directorio actual)
CMD ["serve", "-s", ".", "-l", "4200"]