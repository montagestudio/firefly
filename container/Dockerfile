# Firefly Project
#
# VERSION 1.1

# TODO upgrade to 16.04 LTS
FROM ubuntu:14.04
MAINTAINER Corentin Debost <corentin.debost@kaazing.com>

# Set debconf to run non-interactively
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Install base dependencies
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        software-properties-common \
        ssl-cert \
        curl \
        git \
        zip \
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*  \
    && rm -rf /var/lib/apt/lists/*

# Node
RUN curl -sL https://deb.nodesource.com/setup_4.x -o nodesource_setup.sh
RUN sudo bash nodesource_setup.sh
RUN apt-get install -y nodejs build-essential && \
    apt-get clean

RUN adduser --disabled-password --gecos "" montage
ENV HOME /home/montage

# Populate npm cache with Montage packages
RUN sudo -u montage -g montage mkdir /tmp/npm-cache
# There are issues with removing files in Dockerfiles, so create a new
# directory for each step
RUN sudo -u montage -g montage bash -c "mkdir /tmp/npm-cache/a && cd /tmp/npm-cache/a && npm install montage@0.13 digit@0.4"
RUN sudo -u montage -g montage bash -c "mkdir /tmp/npm-cache/b && cd /tmp/npm-cache/b && npm install montage@0.14 digit@0.5"
RUN sudo -u montage -g montage bash -c "mkdir /tmp/npm-cache/c && cd /tmp/npm-cache/c && npm install montage digit"

# Install popcorn as a repository template
RUN git clone https://github.com/montagejs/popcorn.git /home/montage/popcorn
RUN git --git-dir /home/montage/popcorn/.git remote rm origin

# Install glTFConverter converter
RUN apt-get install -y libxml2-dev libpng12-dev libpcre3-dev cmake&& \
    apt-get clean
RUN git clone https://github.com/KhronosGroup/glTF.git /home/montage/glTF
RUN cd /home/montage/glTF/ && git checkout 63e932907e3f0c834c8668d04f03ddb6eabf78d1 && git submodule init && git submodule update
RUN cd /home/montage/glTF/converter/COLLADA2GLTF && cmake . && make
RUN mv /home/montage/glTF/converter/COLLADA2GLTF/bin/collada2gltf /usr/bin/collada2gltf
RUN chmod +x /usr/bin/collada2gltf && rm -rf /home/montage/glTF

# Add Github's key to the known hosts
# RUN echo github.com,207.97.227.239 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq2A7hRGmdnm9tUDbO9IDSwBK6TbQa+PXYPCPy6rbTrTtw7PHkccKrpp0yVhp5HdEIcKr6pLlVDBfOLX9QUsyCOV0wzfjIJNlGEYsdlLJizHhbn2mUjvSAHQqZETYP81eFzLQNnPHt4EVVUh7VfDESU84KezmD5QlWpXLmvU31/yMf+Se8xhHTvKSCZIFImWwoG6mbUoWf9nzpIoaSjB+weqqUUmpaaasXVal72J+UX2B+2RPW3RcT0eOzQgqlJL3RKrTJvdsjE3JEAvGq3lGHSZXy28G3skua2SmVi/w4yCE6gbODqnTWlg7+wC604ydGXA8VJiS5ap43JXiUFFAaQ== >> /etc/ssh/ssh_known_hosts

ADD . /srv/firefly

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/container/index.js"]
