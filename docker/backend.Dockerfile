# Multi-stage build para optimizar la imagen de producción

# Etapa de construcción
FROM node:20-alpine AS builder

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Instala dependencias de desarrollo para la construcción
RUN npm ci

# Instala NestJS CLI globalmente
RUN npm install -g @nestjs/cli

# Copia el resto de los archivos del proyecto
COPY . .

# Compila la aplicación
RUN npm run build

# Etapa de desarrollo
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g @nestjs/cli
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Etapa de producción
FROM node:20-alpine AS production

# Instala dumb-init para manejo de señales y wget para health checks
RUN apk add --no-cache dumb-init wget

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala solo las dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copia la aplicación compilada desde la etapa de construcción
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Crea el directorio de uploads con permisos para el usuario nestjs
RUN mkdir -p /app/uploads/consent-forms && \
    chown -R nestjs:nodejs /app/uploads

# Cambia al usuario no-root
USER nestjs

# Expone el puerto 3000
EXPOSE 3000

# Comando para iniciar la aplicación en modo de producción
CMD ["dumb-init", "node", "dist/main"]
