# ---- Base versions (adjust Node LTS as needed) ----
ARG NODE_VERSION=22

# ---- 1) Dependencies layer ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# Copy manifest files first (better caching)
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --ignore-optional --production=false

# ---- 2) Build layer (for TypeScript/bundled apps) ----
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Copy dependencies from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/yarn.lock ./yarn.lock

# Copy full source
COPY . .

# Run build (if using TS). If no build step, this will just be skipped.
RUN yarn build || echo "No build script found, skipping."

# ---- 3) Runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=PROD
ENV ENV=PROD

# Use non-root user for security
USER node

# Copy only necessary runtime files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/yarn.lock ./yarn.lock
COPY --from=build --chown=node:node /app/dist ./dist
# If no build step, uncomment:
# COPY --from=build --chown=node:node /app/server.js ./server.js

# Default port
ENV PORT=8000
EXPOSE 8000

# Start the app (ensure "start" script exists in package.json)
CMD ["yarn", "start"]
