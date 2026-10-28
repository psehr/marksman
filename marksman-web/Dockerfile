# BUILD STAGE
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY . .

RUN npm ci

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN test -n "$NEXT_PUBLIC_API_URL"
RUN npm run build --workspace=marksman-web -- --webpack

# RUNTIME STAGE
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node \
    /app/marksman-web/.next/standalone ./

COPY --from=build --chown=node:node \
    /app/marksman-web/.next/static ./marksman-web/.next/static

COPY --from=build --chown=node:node \
    /app/marksman-web/public ./marksman-web/public

USER node

EXPOSE 3000

CMD ["node", "marksman-web/server.js"]