FROM node:24-alpine AS compilacion

WORKDIR /proyecto
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY consola/package.json consola/package.json
RUN npm ci -w api --include-workspace-root
COPY api api
RUN npm run build -w api

FROM node:24-alpine AS dependencias

WORKDIR /proyecto
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY consola/package.json consola/package.json
RUN npm ci --omit=dev -w api --include-workspace-root && npm cache clean --force

FROM node:24-alpine

WORKDIR /proyecto
COPY --from=dependencias --chown=node:node /proyecto/node_modules node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node api/package.json api/package.json
COPY --from=compilacion --chown=node:node /proyecto/api/dist api/dist
COPY --chown=node:node api/db/migraciones api/db/migraciones
COPY --chown=node:node api/db/semillas api/db/semillas
# Certificados raíz de Apple (HU-43.1): tsc no los copia a dist.
COPY --chown=node:node api/adaptadores/pagos/certificados api/adaptadores/pagos/certificados

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/salud/vivo').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "api/dist/servidor.js"]
