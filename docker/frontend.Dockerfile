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

# Etapa de producción
FROM nginx:alpine AS production

# Copia la aplicación compilada desde la etapa de construcción
COPY --from=builder /app/dist/frontend /usr/share/nginx/html

# Crear configuración de nginx para proxy
RUN echo 'server { \
    listen 4200; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Proxy para API \
    location /api/ { \
        proxy_pass http://backend:3000/; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # Servir archivos estáticos \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache para assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expone el puerto 4200
EXPOSE 4200

# Inicia nginx
CMD ["nginx", "-g", "daemon off;"]