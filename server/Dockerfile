# NestJS API (마이그레이션 후 기동)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.deploy.config.cjs ./
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p uploads
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
