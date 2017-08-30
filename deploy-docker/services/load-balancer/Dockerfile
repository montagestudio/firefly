# Firefly Load-balancer
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM ubuntu:14.04
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

# Install Haproxy.
RUN \
  apt-get update && \
  apt-get install -y haproxy && \
  sed -i 's/^ENABLED=.*/ENABLED=1/' /etc/default/haproxy && \
  rm -rf /var/lib/apt/lists/*

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