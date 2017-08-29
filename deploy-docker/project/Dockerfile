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

RUN adduser --disabled-password --gecos "" montage
ENV HOME /home/montage

VOLUME ['/srv/firefly/']

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/project.js"]
