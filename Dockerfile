FROM node:22-alpine

# Instalar dependencias necesarias
RUN apk add --no-cache openssl procps

# Crear y establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar configuración de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (necesarias para el build)
RUN npm install

# Instalar el CLI de Nest de forma global para garantizar que 'nest build' funcione
RUN npm install -g @nestjs/cli

# Copiar el resto del código
COPY . .

# Generar Prisma
RUN npx prisma generate

# Forzar compilación explícita usando el CLI global
RUN nest build

# Exponer el puerto
EXPOSE 8080

# Usar el comando nativo de node, apuntando al archivo generado
CMD ["node", "dist/main.js"]