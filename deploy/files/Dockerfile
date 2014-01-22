# Firefly Project
#
# VERSION 1.0

FROM ubuntu
MAINTAINER Stuart Knightley, stuart@stuartk.com

# Updates
RUN echo "deb http://archive.ubuntu.com/ubuntu precise main universe" > /etc/apt/sources.list
RUN apt-get update
# FIXME [PJYF Jan 22 2014] I added those 2 lines to try and fix warnings. They don't appears to work...
RUN apt-get install -y apt-utils
RUN apt-get install -y dialog

# Curl
RUN apt-get install -y curl

# Git
RUN apt-get install -y git

# Node
RUN apt-get install -y python-software-properties python g++ make software-properties-common
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs

ADD filament /srv/filament

ADD firefly /srv/firefly

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/index.js"]

