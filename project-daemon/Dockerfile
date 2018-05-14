# Firefly Project Daemon

FROM node:carbon
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

# Install base dependencies
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg2 \ 
        software-properties-common \
        \
        build-essential \
        git \
        zip \
        libssl-dev \
        python \
        rsync \
        wget \
        devscripts \
        autoconf \
        ssl-cert \
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*  \
    && rm -rf /var/lib/apt/lists/*

# Docker
RUN curl -fsSL "https://download.docker.com/linux/debian/gpg" | apt-key add -
RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable"
RUN apt-get update
RUN apt-get install docker-ce --assume-yes --allow-unauthenticated

# Testing tools
RUN npm install -g jasmine-node@~1.14.0

WORKDIR /srv/project-daemon/
COPY ./package.json .
RUN npm install --prefix .
COPY . .

CMD [ "node", "index.js" ]

EXPOSE 2440
