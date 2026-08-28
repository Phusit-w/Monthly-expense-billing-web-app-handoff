# Multi-stage build for on-prem/intranet deployment.
# See DEPLOY.md for how to run the resulting image with docker-compose.

# ---- deps: install once, reused by both the builder and the runtime image ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and produce the Next.js build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` only reads the schema, it never connects to this URL —
# but prisma.config.ts requires DATABASE_URL to be defined to build config.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# ---- runner: minimal image that actually ships ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Full node_modules first (needed at runtime for `prisma migrate deploy` —
# the CLI, dotenv, and its TS config loader aren't things app code imports,
# so Next's standalone trace below won't include them on its own).
COPY --from=deps /app/node_modules ./node_modules
# Next's traced output overlays on top: trimmed node_modules + server.js +
# the compiled app. Everything it doesn't touch (prisma, dotenv, ...) survives.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data/soc && chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app /data/soc

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
