FROM node:22-alpine

WORKDIR /

# Dependencies zuerst kopieren, damit der Layer-Cache greift
COPY package*.json ./
RUN npm install  

COPY . .

ENV NODE_ENV=production

# Nicht als root laufen lassen
USER node

CMD ["node", "index.ts"]
