# Usa una imagen de Node.js como base
FROM node:18-alpine

# Establece el directorio de trabajo en /app
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Instala Angular CLI globalmente
RUN npm install -g @angular/cli

# Copia el resto de los archivos del proyecto
COPY . .

# Expone el puerto 4200
EXPOSE 4200

# Comando para iniciar la aplicación en el contenedor
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]