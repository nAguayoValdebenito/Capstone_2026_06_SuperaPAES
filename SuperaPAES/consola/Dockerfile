FROM node:24-alpine AS compilacion

WORKDIR /proyecto
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY consola/package.json consola/package.json
RUN npm ci -w consola --include-workspace-root
COPY consola consola
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" && VITE_API_URL="$VITE_API_URL" npm run build -w consola

FROM nginxinc/nginx-unprivileged:1.29-alpine

# La plantilla se rellena al arrancar (VITE_API_URL en connect-src). nginx corre sin ser root, en el 8080.
ENV VITE_API_URL=http://localhost:3000
COPY consola/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=compilacion /proyecto/consola/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
