# 1. Usar versión compatible con Prisma
FROM node:22-alpine

# 2. Instalar dependencias del sistema requeridas por Prisma
RUN apk add --no-cache openssl procps

# 3. Establecer directorio de trabajo
WORKDIR /usr/src/app

# 4. Copiar SOLO archivos de dependencias primero (incluyendo package-lock si existe)
COPY package*.json ./

# 5. Instalar TODAS las dependencias (incluyendo las de desarrollo como @nestjs/cli)
RUN npm install

# 6. Copiar TODO el código fuente (incluyendo tsconfig.json y nest-cli.json)
COPY . .

# 7. Generar Prisma Client
RUN npx prisma generate

# 8. Forzar la compilación con la CLI de Nest (esto asegura que se cree la carpeta dist)
RUN npx @nestjs/cli build

# 9. Exponer el puerto por defecto (opcional, pero buena práctica)
EXPOSE 8080

# 10. Comando de inicio apuntando al archivo generado
CMD ["node", "dist/main.js"]