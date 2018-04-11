# Firefly Project Daemon
#
# VERSION 1.1

FROM firefly
LABEL author="Harold Thetiot <harold.thetiot@montagestudio.com>"

# Docker
RUN curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" | sudo apt-key add -
RUN sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
RUN sudo apt-get update
RUN sudo sudo apt-get install docker-ce --assume-yes --allow-unauthenticated

# Docker compose
RUN sudo curl -L https://github.com/docker/compose/releases/download/1.20.1/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
RUN sudo chmod +x /usr/local/bin/docker-compose
RUN docker-compose version

COPY project-daemon/ /srv/project-daemon/
RUN npm install --prefix /srv/project-daemon/
COPY common/ /srv/project-daemon/common/
RUN npm install --prefix /srv/project-daemon/common/

# Define default command.
ENTRYPOINT [ "node", "/srv/project-daemon" ]

# Expose ports.
EXPOSE 2440