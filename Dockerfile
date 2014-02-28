# Firefly Project
#
# VERSION 1.0

# This file needs to me moved up as a sibling of firefly and filament

FROM ubuntu
MAINTAINER Stuart Knightley, stuart@stuartk.com

# Updates
RUN echo "deb http://archive.ubuntu.com/ubuntu precise main universe" > /etc/apt/sources.list
RUN apt-get update

# Curl
RUN apt-get install -y curl

# Git
RUN apt-get install -y git

# Node
RUN apt-get install -y python-software-properties python g++ make software-properties-common
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs

RUN adduser --disabled-password --gecos "" montage
ENV HOME /home/montage

# If you change this then you also need to update `mountVolume` in
# /srv/firefly/project.js for development
ADD firefly /srv/firefly
ADD filament /srv/filament

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/container/index.js"]

