FROM node:20-alpine
WORKDIR /app

# Copy root package.json for workspace resolution
COPY package.json .

# Copy workspace package.json files
COPY packages/shared-types/package.json packages/shared-types/
COPY services/dice-service/package.json services/dice-service/

# Install from root (resolves workspace:* deps)
RUN npm install --workspace=@helm/dice-service --workspace=@helm/shared-types

# Copy source
COPY packages/shared-types/ packages/shared-types/
COPY services/dice-service/ services/dice-service/

EXPOSE 3001
CMD ["npx", "tsx", "services/dice-service/src/index.ts"]
