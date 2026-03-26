# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* vars are baked into the JS bundle at build time
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Stage 2: production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=builder /app/dist ./dist
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
