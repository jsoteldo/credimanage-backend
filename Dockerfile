FROM node:22-alpine
RUN apk add --no-cache openssl procps
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npx @nestjs/cli build

EXPOSE 8080

# ¡Aquí está la corrección vital!
CMD ["node", "dist/src/main.js"]