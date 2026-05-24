FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html styles.css app.js ./
COPY data ./data
COPY database ./database

ENV NODE_ENV=production
ENV PORT=4174

EXPOSE 4174

CMD ["npm", "start"]
