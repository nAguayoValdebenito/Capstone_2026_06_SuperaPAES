FROM node:24-alpine AS compilacion

WORKDIR /proyecto
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY consola/package.json consola/package.json
RUN npm ci -w consola --include-workspace-root
COPY consola consola
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" && VITE_API_URL="$VITE_API_URL" npm run build -w consola

FROM nginx:alpine

COPY consola/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /proyecto/consola/dist /usr/share/nginx/html
EXPOSE 80
