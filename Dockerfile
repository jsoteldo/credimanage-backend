# 1. Usar una imagen de Node.js ligera como base
FROM node:18-alpine

# 2. Crear y establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# 3. Copiar solo los archivos de dependencias primero (optimiza el caché de Docker)
COPY package*.json ./

# 4. Instalar las dependencias
RUN npm install

# 5. Copiar el resto del código de tu proyecto
COPY . .

# 6. Compilar el código TypeScript de Nest.js a JavaScript
RUN npm run build

# 7. Iniciar la aplicación compilada
CMD ["node", "dist/main"]
