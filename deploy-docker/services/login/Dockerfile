# Firefly Login
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

# Define mountable directories.
VOLUME ['/srv/firefly/']

# Define default command.
ENTRYPOINT ["node", "/srv/firefly/login.js"]

# Expose ports.
EXPOSE 2441
