# Firefly Project Daemon

FROM firefly
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

# Docker
RUN curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" | apt-key add -
RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
RUN apt-get update
RUN apt-get install docker-ce --assume-yes --allow-unauthenticated

# Docker compose
RUN curl -L https://github.com/docker/compose/releases/download/1.20.1/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose
RUN docker-compose version

COPY project-daemon/ /srv/project-daemon/
RUN npm install --prefix /srv/project-daemon/ --production
COPY common/ /srv/project-daemon/common/
RUN npm install --prefix /srv/project-daemon/common/ --production

# Define default command.
ENTRYPOINT [ "node", "/srv/project-daemon" ]

# Expose ports.
EXPOSE 2440