FROM node:22-alpine

# Instalar dependencias necesarias para Prisma y Node en Alpine
RUN apk add --no-cache openssl procps

WORKDIR /usr/src/app

# Copiar manifiestos de paquetes
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Normalizar saltos de línea y dar permisos de ejecución al entrypoint
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Generar cliente de Prisma
RUN npx prisma generate

# Compilar proyecto NestJS
RUN npx @nestjs/cli build

# Variables de entorno por defecto para Google Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]

CMD ["node", "dist/src/main.js"]