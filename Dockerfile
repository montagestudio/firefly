# Firefly Project
#
# VERSION 1.0

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

RUN mkdir /workspace
RUN chown -R montage:montage /workspace

ADD . /srv

EXPOSE 2441
ENTRYPOINT ["node", "/srv/container/index.js"]

