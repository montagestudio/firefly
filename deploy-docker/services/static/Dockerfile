# Firefly Static
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM ubuntu:14.04
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

# Install Nginx.
RUN apt-get update && \
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
