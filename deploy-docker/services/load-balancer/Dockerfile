# Firefly Load-balancer
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

# Install Haproxy.
RUN add-apt-repository --yes ppa:vbernat/haproxy-1.5
RUN apt-get update --fix-missing

# Download HAProxy
RUN apt-get --yes install haproxy=1.5*
RUN sed -i 's/^ENABLED=.*/ENABLED=1/' /etc/default/haproxy

# Add files.
ADD /etc/haproxy/haproxy.cfg etc/haproxy/haproxy.cfg
ADD /etc/haproxy/errors etc/haproxy/errors

# Define working directory.
WORKDIR /etc/haproxy

# Define default command.
COPY entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Expose ports.
EXPOSE 80
EXPOSE 443