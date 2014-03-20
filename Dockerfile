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

# Zip
RUN apt-get install -y zip

# Node
RUN apt-get install -y python-software-properties python g++ make software-properties-common
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs

RUN adduser --disabled-password --gecos "" montage
ENV HOME /home/montage

# Populate npm cache with Montage packages
RUN sudo -u montage -g montage mkdir /tmp/npm-cache
# There are issues with removing files in Dockerfiles, so create a new
# directory for each step
RUN sudo -u montage -g montage bash -c "mkdir /tmp/npm-cache/a && cd /tmp/npm-cache/a && npm install montage@0.13 digit@0.4"
RUN sudo -u montage -g montage bash -c "mkdir /tmp/npm-cache/b && cd /tmp/npm-cache/b && npm install montage@0.14 digit@0.5"
RUN sudo -u montage -g montage bash -c "mkdir /tmp/npm-cache/c && cd /tmp/npm-cache/c && npm install montage digit"

# If you change this then you also need to update `mountVolume` in
# /srv/firefly/project.js for development
ADD firefly /srv/firefly
ADD filament /srv/filament

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/container/index.js"]

