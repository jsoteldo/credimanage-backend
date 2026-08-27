FROM node:22-alpine
RUN apk add --no-cache openssl procps
WORKDIR /usr/src/app

COPY package*.json ./
# Forzamos la instalación de todas las dependencias (incluyendo las de desarrollo para asegurar que TypeScript esté presente)
RUN npm install

COPY . .
RUN npx prisma generate

# Ejecutamos el build estándar
RUN npm run build

# --- BLOQUE DE DIAGNÓSTICO ---
# Esto imprimirá la lista de archivos reales en la consola de Cloud Build
RUN echo "--- CONTENIDO DE LA RAÍZ ---" && ls -la
RUN echo "--- CONTENIDO DE DIST ---" && ls -la dist || echo "🔥 LA CARPETA DIST NO SE CREO"

EXPOSE 8080
# Usamos el script oficial de NestJS en lugar de buscar la ruta a mano
CMD ["npm", "run", "start:prod"]