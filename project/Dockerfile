# Firefly Project
#
# VERSION 1.1

FROM ubuntu:16.04
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

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

# Node
RUN curl -sL https://deb.nodesource.com/setup_8.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install -y nodejs build-essential && \
    apt-get clean

# Install glTFConverter converter
RUN apt-get install -y libxml2-dev libpng12-dev libpcre3-dev cmake&& \
    apt-get clean
RUN git clone https://github.com/KhronosGroup/glTF.git /tmp/glTF
RUN cd /tmp/glTF/ && git checkout 63e932907e3f0c834c8668d04f03ddb6eabf78d1 && git submodule init && git submodule update
RUN cd /tmp/glTF/converter/COLLADA2GLTF && cmake . && make
RUN mv /tmp/glTF/converter/COLLADA2GLTF/bin/collada2gltf /usr/bin/collada2gltf
RUN chmod +x /usr/bin/collada2gltf && rm -rf /tmp/glTF

COPY project/ /srv/project
RUN npm install --prefix /srv/project/
RUN npm install --prefix /srv/project/common/

RUN adduser --disabled-password --gecos "" montage
ENV HOME /home/montage
USER montage

# Populate npm cache with Montage packages
RUN mkdir /tmp/npm-cache
# There are issues with removing files in Dockerfiles, so create a new
# directory for each step
RUN mkdir /tmp/npm-cache/a && cd /tmp/npm-cache/a && npm install montage@0.13 digit@0.4
RUN mkdir /tmp/npm-cache/b && cd /tmp/npm-cache/b && npm install montage@0.14 digit@0.5
RUN mkdir /tmp/npm-cache/c && cd /tmp/npm-cache/c && npm install montage digit

# Install popcorn as a repository template
RUN git clone https://github.com/montagejs/popcorn.git /home/montage/popcorn
RUN git --git-dir /home/montage/popcorn/.git remote rm origin

USER root
EXPOSE 2441
ENTRYPOINT ["node", "/srv/project/index.js"]
