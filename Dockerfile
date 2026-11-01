# Static build served by nginx. BASE_PATH lets the same image sit behind a sub-path. The base images
# are pinned by digest (the multi-arch index; audit TT3-11) and Dependabot proposes the bumps; the
# Node major is the one .nvmrc names.
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606
ARG BASE_PATH=/
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BASE_PATH=$BASE_PATH
COPY --from=build /app/dist /usr/share/nginx/html${BASE_PATH}
EXPOSE 80
