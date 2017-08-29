# Firefly Project
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM ubuntu:14.04
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

# Updates
RUN apt-get update

# System tools
RUN apt-get install -y sudo curl git zip && \
    apt-get clean

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

VOLUME ['/srv/firefly/']

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/project.js"]
