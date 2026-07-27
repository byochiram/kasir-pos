# syntax=docker/dockerfile:1

# better-sqlite3 adalah modul native: harus dikompilasi di lingkungan yang sama
# dengan tempat ia dijalankan. Karena itu dependensi dipasang di tahap terpisah
# dengan toolchain build, lalu hasilnya disalin — bukan dipasang ulang di runtime.
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# JWT_SECRET tidak dipakai saat build, tapi modul auth menolak nilai pendek.
# Nilai sungguhan diberikan lewat environment saat container dijalankan.
ENV JWT_SECRET=placeholder-hanya-untuk-proses-build-minimal-32-karakter
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Database disimpan di volume, bukan di dalam image.
ENV DATABASE_PATH=/data/kasir.db

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && mkdir -p /data && chown -R nextjs:nodejs /data

# output: 'standalone' menghasilkan bundel berisi hanya dependensi yang benar-benar
# dipakai, jauh lebih kecil daripada menyalin seluruh node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
