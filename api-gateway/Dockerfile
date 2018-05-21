FROM node:carbon

RUN mkdir -p /opt/app/
WORKDIR /opt/app

COPY ./package.json /opt/app/
COPY ./package-lock.json /opt/app/
RUN npm install

COPY ./ /opt/app/

EXPOSE 80
CMD ["node", "index.js"]
