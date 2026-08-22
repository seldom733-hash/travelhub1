FROM node:22-alpine
RUN apk add --no-cache openssl python3 make g++ git
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 4000
