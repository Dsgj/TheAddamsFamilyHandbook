# Static build served by nginx. BASE_PATH lets the same image sit behind a sub-path. The base images
# are pinned by digest (the multi-arch index; audit TT3-11) and Dependabot proposes the bumps; the
# Node major is the one .nvmrc names.
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine@sha256:a3554c0d0b48177b1413c26e01f695334428020d9df01243fbae3e11cfd17417
ARG BASE_PATH=/
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BASE_PATH=$BASE_PATH
COPY --from=build /app/dist /usr/share/nginx/html${BASE_PATH}
EXPOSE 80
