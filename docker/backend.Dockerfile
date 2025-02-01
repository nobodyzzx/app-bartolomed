# Usa una imagen de Node.js como base
FROM docker.io/node:18

# Establece el directorio de trabajo en /app
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm ci

# Instala NestJS CLI globalmente
RUN npm install -g @nestjs/cli

# Copia el resto de los archivos del proyecto
COPY . .

# Compila la aplicación
RUN npm run build

# Expone el puerto 3000
EXPOSE 3000

# Comando para iniciar la aplicación en modo de desarrollo
CMD ["npm", "run", "start:dev"]
