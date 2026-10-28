# BUILD STAGE
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build --workspace=marksman-api

# MIGRATION STAGE
FROM build AS migrations

WORKDIR /app/marksman-api

USER node

CMD ["npm", "run", "db:migrate"]

# RUNTIME STAGE
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY marksman-api/package.json ./marksman-api/package.json
COPY marksman-web/package.json ./marksman-web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

RUN npm ci --omit=dev --ignore-scripts \
    --workspace=marksman-api \
    --workspace=@marksman/contracts

COPY --from=build /app/marksman-api/dist ./marksman-api/dist
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist

USER node

EXPOSE 3001

CMD ["node", "marksman-api/dist/index.js"]