FROM node:carbon

RUN mkdir -p /opt/workspace
WORKDIR /opt/workspace

COPY ./package.json ./
RUN npm install --production

COPY . .

EXPOSE 80
CMD ["node", "index.js"]
