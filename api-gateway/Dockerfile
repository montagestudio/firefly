FROM node:carbon

RUN mkdir -p /opt/app/
WORKDIR /opt/app

# Testing tools
RUN npm install -g mocha@^5.1.1

COPY ./package.json /opt/app/
COPY ./package-lock.json /opt/app/
RUN npm install

COPY ./ /opt/app/

EXPOSE 80
CMD ["node", "index.js"]
