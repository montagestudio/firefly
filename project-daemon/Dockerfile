# Firefly Project Daemon

FROM ubuntu:16.04
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

# Set debconf to run non-interactively
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Install base dependencies
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        git \
        zip \
        libssl-dev \
        python \
        rsync \
        software-properties-common \
        wget \
        devscripts \
        autoconf \
        ssl-cert \
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*  \
    && rm -rf /var/lib/apt/lists/*

# Node
RUN curl -sL https://deb.nodesource.com/setup_4.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install -y nodejs build-essential && \
    apt-get clean

# Docker
RUN curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" | apt-key add -
RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
RUN apt-get update
RUN apt-get install docker-ce --assume-yes --allow-unauthenticated

# Docker compose
RUN curl -L https://github.com/docker/compose/releases/download/1.20.1/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose
RUN docker-compose version

# Testing tools
RUN npm install -g jasmine-node@~1.14.0

WORKDIR /srv/project-daemon/
COPY ./package.json .
RUN npm install --prefix .
COPY . .

CMD [ "node", "index.js" ]

EXPOSE 2440
