FROM node:20-alpine
WORKDIR /app

# Copy root package.json for workspace resolution
COPY package.json .

# Copy workspace package.json files
COPY packages/shared-types/package.json packages/shared-types/
COPY services/state-engine/package.json services/state-engine/
COPY services/rules-engine/package.json services/rules-engine/
COPY services/api-gateway/package.json services/api-gateway/

# Install from root (resolves workspace:* deps)
RUN npm install --workspace=@helm/api-gateway --workspace=@helm/shared-types --workspace=@helm/rules-engine --workspace=@helm/state-engine

# Copy source
COPY packages/shared-types/ packages/shared-types/
COPY services/state-engine/ services/state-engine/
COPY services/rules-engine/ services/rules-engine/
COPY services/api-gateway/ services/api-gateway/
COPY devdata/ devdata/

EXPOSE 3000
CMD ["npx", "tsx", "services/api-gateway/src/index.ts"]
