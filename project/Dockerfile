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
WORKDIR /srv/project/
COPY ./package.json .
RUN npm install --prefix .
COPY ./ .
RUN npm install --prefix ./common/

EXPOSE 2441
CMD ["npm", "start"]
