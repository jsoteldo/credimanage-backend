# 1. Usar una versión de Node soportada por tu versión de Prisma
FROM node:22-alpine

# 2. Instalar OpenSSL (Requisito obligatorio de Prisma en Alpine Linux)
RUN apk add --no-cache openssl

# 3. Crear y establecer el directorio de trabajo
WORKDIR /usr/src/app

# 4. Copiar dependencias e instalar
COPY package*.json ./
RUN npm install

# 5. Copiar el resto del código
COPY . .

# 6. Generar el cliente de Prisma (CRÍTICO para que la base de datos funcione)
RUN npx prisma generate

# 7. Compilar Nest.js
RUN npm run build

# 8. Iniciar la aplicación
CMD ["node", "dist/main"]