# Firefly Project

FROM montagestudio/collada2gltf:latest

FROM ubuntu:16.04
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

FROM node:4.8.7

COPY --from=0 /usr/bin/collada2gltf /user/bin/collada2gltf

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
COPY ./package.json /srv/project/
RUN npm install --prefix /srv/project/ --production

COPY ./ /srv/project
RUN npm install --prefix /srv/project/common/ --production

# Restore ownership of .npm to montage, this gets owned by root when we npm install the project
# I don't really know why we want the montage user to exist in the first place, maybe we
# should just do everything as root?
RUN chown -R montage /home/montage/.npm

EXPOSE 2441
ENTRYPOINT ["node", "/srv/project/index.js"]
