# Static build served by nginx. BASE_PATH lets the same image sit behind a sub-path. The base images
# are pinned by digest (the multi-arch index; audit TT3-11) and Dependabot proposes the bumps; the
# Node major is the one .nvmrc names.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2
ARG BASE_PATH=/
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BASE_PATH=$BASE_PATH
COPY --from=build /app/dist /usr/share/nginx/html${BASE_PATH}
EXPOSE 80
