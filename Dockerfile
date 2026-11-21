FROM mcr.microsoft.com/dotnet/sdk:10.0.404-alpine3.24 AS toolchain

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
RUN apk add --no-cache nodejs npm yarn python3 \
    && dotnet workload install wasm-tools --skip-manifest-update

FROM toolchain AS build

# The address the site is served at, see lib/site.ts
ARG SITE_URL
WORKDIR /src
COPY . .
RUN --mount=type=cache,target=/root/.nuget/packages \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile \
    && yarn build

FROM node:24-alpine AS site

WORKDIR /app
ENV HOSTNAME=0.0.0.0

COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public
COPY --from=build /src/playground/artifacts/web ./playground/artifacts/web

USER node
EXPOSE 3000
CMD ["node", "server.js"]
