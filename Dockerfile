FROM node:20.3.1-alpine3.17 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20.3.1-alpine3.17
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit dev
COPY --from=builder /usr/src/app/dist/ ./dist/
CMD npx wait-port rabbit:5672 && \
    npm start