FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

USER root

# Firebase CLI (the only project-specific runtime dep beyond Node/pnpm/TS,
# which the typescript-node base already provides). pnpm is managed via
# corepack from the `packageManager` field in package.json — no extra install.
RUN npm install -g firebase-tools@13

USER node
