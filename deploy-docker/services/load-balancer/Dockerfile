# Firefly Load-balancer
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

# haproxy
RUN apt-get install -y haproxy && \
    apt-get clean


ADD /etc/haproxy/haproxy.cfg etc/haproxy/haproxy.cfg
ADD /etc/haproxy/errors etc/haproxy/errors

EXPOSE 8182
EXPOSE 2440

# TODO entrypoint haproxy