FROM node:20.6-alpine3.17 AS builder
WORKDIR /usr/src/app
COPY . .
RUN npm ci && npm run build

FROM node:20.6-alpine3.17
WORKDIR /usr/src/app
COPY package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
CMD npm ci --omit dev && \
    npx wait-port rabbit:5672 && \
    npm start