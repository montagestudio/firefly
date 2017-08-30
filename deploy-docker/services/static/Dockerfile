# Firefly Static
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

# Install Nginx.
RUN dd-apt-repository -y ppa:nginx/stable && \
	apt-get update && \
  	apt-get install -y nginx && \
  	rm -rf /var/lib/apt/lists/* && \
  	chown -R www-data:www-data /var/lib/nginx

# Add files.
ADD etc/nginx/nginx.conf etc/nginx/nginx.conf

# Define working directory.
WORKDIR /etc/nginx

# Define mountable directories.
VOLUME ['/srv/filament/']

# Define default command.
COPY entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Expose ports.
EXPOSE 80
EXPOSE 443
