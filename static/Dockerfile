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

RUN apt-get update
RUN apt-get install -y nginx

# Configure SSH so we can clone from private repos
RUN apt-get install -y openssh-server
RUN mkdir /root/.ssh
COPY traefik/ssl/id_rsa /root/.ssh/id_rsa
RUN chmod 400 /root/.ssh/id_rsa
RUN echo "    IdentityFile /root/.ssh/id_rsa" >> /etc/ssh/ssh_config
RUN echo "    StrictHostKeyChecking=no" >> /etc/ssh/ssh_config

COPY static/nginx.conf /etc/nginx/nginx.conf
COPY static/filament /srv/app
RUN npm install --prefix /srv/app/
# TODO Fix in montage
RUN npm install --prefix /srv/app/node_modules/montage

CMD nginx -g 'daemon off;'
