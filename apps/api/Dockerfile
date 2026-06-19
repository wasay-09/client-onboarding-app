# Optional containerized alternative to the systemd unit (see docs/DEPLOY.md).
# Build from the REPO ROOT (it's a pnpm monorepo):
#   docker build -f apps/api/Dockerfile -t onboarding-api .
#   docker run --env-file deploy/onboarding-api.env -p 127.0.0.1:3001:3001 onboarding-api
#
# The API runs via vite-node (no compile step), so devDependencies are required at
# runtime — do NOT install with --prod.
FROM node:22-slim
RUN corepack enable
WORKDIR /app

# Copy the whole workspace (the .dockerignore strips node_modules/dist/.data/.git).
# A full lockfile install needs every workspace package.json present.
COPY . .
RUN pnpm install --frozen-lockfile

ENV PORT=3001
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
