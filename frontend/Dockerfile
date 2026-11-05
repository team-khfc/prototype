# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
ARG BACKEND_INTERNAL_URL=http://backend:8080
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
COPY frontend ./frontend
COPY scripts/build-frontend.mjs ./scripts/build-frontend.mjs
RUN npm test && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
COPY --chown=node:node frontend/scripts/docker-healthcheck.mjs frontend/scripts/docker-smoke.mjs ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "scripts/docker-healthcheck.mjs"]
CMD ["node", "frontend/server.js"]
