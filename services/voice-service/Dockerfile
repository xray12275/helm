FROM node:20-alpine
WORKDIR /app

# Copy root package.json for workspace resolution
COPY package.json .

# Copy workspace package.json files
COPY packages/shared-types/package.json packages/shared-types/
COPY services/voice-service/package.json services/voice-service/

# Install from root (resolves workspace:* deps)
RUN npm install --workspace=@helm/voice-service --workspace=@helm/shared-types

# Copy source
COPY packages/shared-types/ packages/shared-types/
COPY services/voice-service/ services/voice-service/

EXPOSE 3002
CMD ["npx", "tsx", "services/voice-service/src/index.ts"]
