# Firefly Project
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM ubuntu:14.04
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

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
RUN sudo bash nodesource_setup.sh
RUN apt-get install -y nodejs build-essential && \
    apt-get clean

# Docker
RUN curl -sSL "https://get.docker.com/gpg" | sudo -E apt-key add -
RUN echo "deb https://apt.dockerproject.org/repo ubuntu-trusty main" | sudo tee -a /etc/apt/sources.list
RUN sudo apt-get update
RUN sudo sudo apt-get install python-pip docker-engine --assume-yes --allow-unauthenticated

# Update Pip
RUN sudo pip install --upgrade pip

# Update docker-compose via pip
RUN sudo pip install docker-compose
RUN docker-compose version

# Define mountable directories.
VOLUME ['/srv/firefly/']

# Define default command.
ENTRYPOINT ["node", "/srv/firefly/project.js"]

# Expose ports.
EXPOSE 2441