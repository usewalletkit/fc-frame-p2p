# syntax = docker/dockerfile:1

ARG NODE_VERSION=18.19.1
FROM node:${NODE_VERSION}-bookworm as base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

FROM base as build

# Install node modules
COPY --link package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY --link . .

FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "serve" ]
