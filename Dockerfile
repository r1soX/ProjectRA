# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# System deps Prisma needs on Alpine.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .
# Placeholders so build-time module loads never fail on missing env (the real
# values come from docker-compose at runtime; the build never touches the DB).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-time-placeholder"
# Generate the Prisma client, then build Next.
RUN npx prisma generate && npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Copy the built app + everything the runtime and Prisma CLI need.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
# Strip any CRLF (in case the script was authored on Windows) and make it exec.
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3000
# Sync the schema to Postgres (idempotent) then start Next.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
