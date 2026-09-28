FROM node:22-alpine

WORKDIR /

COPY package*.json ./
RUN npm install  

COPY . .

ENV NODE_ENV=production

USER node

CMD ["node", "index.ts"]
