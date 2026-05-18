# Stage 1: build web (Vite client + server bundle)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* vars are baked into the JS bundle at build time
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Stage 2: build PWA (mobile/dist via expo export -p web)
FROM node:20-alpine AS pwa-builder
WORKDIR /app/mobile
# Copia configs do mobile pra resolver deps
COPY mobile/package*.json ./
RUN npm ci --include=dev
COPY mobile ./
# Copia public root pra setup-skia-web encontrar canvaskit
RUN node node_modules/@shopify/react-native-skia/scripts/setup-canvaskit.js public
RUN npx expo export -p web && node scripts/inject-pwa-html.mjs

# Stage 3: production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=builder /app/dist ./dist
# Build da PWA fica em mobile/dist — servido pela rota /app
COPY --from=pwa-builder /app/mobile/dist ./mobile/dist
# scripts/ é necessário em runtime para migrações pontuais (ex: migrate:post-images)
COPY scripts ./scripts
COPY shared ./shared
COPY ["mobile/casa da bee", "./mobile/casa da bee"]
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
