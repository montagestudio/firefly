# Firefly Project

FROM montagestudio/collada2gltf:latest
FROM node:4.8.7
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

COPY --from=0 /usr/bin/collada2gltf /usr/bin/collada2gltf

# Populate npm cache with Montage packages
RUN npm cache add montage@16
RUN npm cache add montage@17
RUN npm cache add montage

# Install popcorn as a repository template
RUN git clone https://github.com/montagejs/popcorn.git ~/popcorn
RUN git --git-dir ~/popcorn/.git remote rm origin

# Add server code
COPY ./package.json /srv/project/
RUN npm install --prefix /srv/project/ --production
COPY ./ /srv/project
RUN npm install --prefix /srv/project/common/ --production

EXPOSE 2441
ENTRYPOINT ["node", "/srv/project/index.js"]
