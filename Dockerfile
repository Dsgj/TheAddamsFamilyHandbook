# Static build served by nginx. BASE_PATH lets the same image sit behind a sub-path.
FROM node:22-alpine AS build
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
ARG BASE_PATH=/
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BASE_PATH=$BASE_PATH
COPY --from=build /app/dist /usr/share/nginx/html${BASE_PATH}
EXPOSE 80
