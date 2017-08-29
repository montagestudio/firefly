# Firefly Static
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

# nginx
RUN apt-get install -y nginx && \
    apt-get clean

ADD etc/nginx/nginx.conf etc/nginx/nginx.conf

# TODO entrypoint ngninx 