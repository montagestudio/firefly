# Firefly Project Daemon
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM firefly
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

# Docker
RUN curl -sSL "https://get.docker.com/gpg" | sudo -E apt-key add -
RUN echo "deb https://apt.dockerproject.org/repo ubuntu-trusty main" | sudo tee -a /etc/apt/sources.list
RUN sudo apt-get update
RUN sudo sudo apt-get install python-pip docker-engine --assume-yes --allow-unauthenticated

# Update Pip
RUN sudo pip install --upgrade pip

# Update docker-compose via pip
RUN sudo pip install docker-compose
RUN docker-compose version

COPY project-daemon/ /srv/
COPY common/ /srv/project-daemon/

# Define default command.
ENTRYPOINT [ "node", "/srv/project-daemon" ]

# Expose ports.
EXPOSE 2440