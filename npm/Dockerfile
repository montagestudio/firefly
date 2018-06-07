FROM node:4.8.7

RUN mkdir -p /opt/app/
WORKDIR /opt/app

# Testing tools
RUN npm install -g mocha

COPY ./package.json /opt/app/
RUN npm install

COPY ./ /opt/app/

EXPOSE 80
CMD ["node", "index.js"]
