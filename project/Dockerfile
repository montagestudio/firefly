# Firefly Project

FROM montagestudio/collada2gltf:latest
FROM node:carbon
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

COPY --from=0 /usr/bin/collada2gltf /usr/bin/collada2gltf

RUN git config --global user.email "noreply@kaazing.com"
RUN git config --global user.name "firefly"

# Populate npm cache with Montage packages
RUN npm cache add montage@16
RUN npm cache add montage@17
RUN npm cache add montage

# Install popcorn as a repository template
RUN git clone https://github.com/montagejs/popcorn.git ~/popcorn
RUN git --git-dir ~/popcorn/.git remote rm origin

# Testing tools
RUN npm install -g jasmine-node@~1.14.0

# Add server code
WORKDIR /srv/project/
COPY ./package.json .
RUN npm install --prefix .
COPY . .

EXPOSE 2441
ENTRYPOINT [ "node", "index.js" ]
