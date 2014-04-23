# Firefly Project
#
# VERSION 1.0

# This file needs to me moved up as a sibling of firefly and filament

FROM ubuntu:13.10
MAINTAINER Stuart Knightley, stuart@stuartk.com

# Updates
RUN echo "deb http://archive.ubuntu.com/ubuntu saucy main universe" > /etc/apt/sources.list
RUN apt-get update

# Sudo
RUN apt-get install -y sudo

# Curl
RUN apt-get install -y curl

# Git
RUN apt-get install -y git

# Zip
RUN apt-get install -y zip

# Node
RUN apt-get install -y python-software-properties python g++ make software-properties-common
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs

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
RUN apt-get install -y libxml2-dev libpng12-dev libpcre3-dev cmake
RUN git clone --recurse-submodules https://github.com/KhronosGroup/glTF.git /home/montage/glTF
RUN cd /home/montage/glTF/ && git checkout 1b34a658c096795b4449b08ba2b1020e98307137
RUN cd /home/montage/glTF/converter/COLLADA2GLTF && cmake . && make
RUN mv /home/montage/glTF/converter/COLLADA2GLTF/bin/collada2gltf /usr/bin/collada2gltf
RUN chmod +x /usr/bin/collada2gltf && rm -rf /home/montage/glTF

# Add Github's key to the known hosts
RUN echo github.com,207.97.227.239 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq2A7hRGmdnm9tUDbO9IDSwBK6TbQa+PXYPCPy6rbTrTtw7PHkccKrpp0yVhp5HdEIcKr6pLlVDBfOLX9QUsyCOV0wzfjIJNlGEYsdlLJizHhbn2mUjvSAHQqZETYP81eFzLQNnPHt4EVVUh7VfDESU84KezmD5QlWpXLmvU31/yMf+Se8xhHTvKSCZIFImWwoG6mbUoWf9nzpIoaSjB+weqqUUmpaaasXVal72J+UX2B+2RPW3RcT0eOzQgqlJL3RKrTJvdsjE3JEAvGq3lGHSZXy28G3skua2SmVi/w4yCE6gbODqnTWlg7+wC604ydGXA8VJiS5ap43JXiUFFAaQ== >> /etc/ssh/ssh_known_hosts

# If you change this then you also need to update `mountVolume` in
# /srv/firefly/project.js for development
ADD firefly /srv/firefly
ADD filament /srv/filament

EXPOSE 2441
ENTRYPOINT ["node", "/srv/firefly/container/index.js"]

