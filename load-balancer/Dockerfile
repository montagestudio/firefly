# Firefly Load-balancer
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM firefly
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

# Install Haproxy.
RUN add-apt-repository --yes ppa:vbernat/haproxy-1.5
RUN apt-get update --fix-missing

# Download HAProxy
RUN apt-get --yes install haproxy=1.5*
RUN sed -i 's/^ENABLED=.*/ENABLED=1/' /etc/default/haproxy

# Add files.
ADD load-balancer/etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg
ADD load-balancer/etc/rsyslog.d/30-haproxy.conf /etc/rsyslog.d/30-haproxy.conf
ADD load-balancer/etc/haproxy/errors /etc/haproxy/errors
ADD load-balancer/etc/ssl/*.pem /etc/ssl/

# Define working directory.
WORKDIR /etc/haproxy

# Define default command.
COPY load-balancer/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Expose ports.
EXPOSE 80
EXPOSE 443