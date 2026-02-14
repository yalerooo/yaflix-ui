ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base

RUN npm install -g pnpm

WORKDIR /usr/src/app

FROM base AS build

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM base AS final

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json .

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/. ./.

EXPOSE 3000

CMD ["pnpm", "start"]