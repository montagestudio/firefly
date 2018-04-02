# Firefly Login
#
# VERSION 1.1

FROM firefly
LABEL author="Harold Thetiot <harold.thetiot@montagestudio.com>"

COPY login/ /srv/login/
RUN npm install --prefix /srv/login/
COPY common/ /srv/login/common/
RUN npm install --prefix /srv/login/common/

# Define default command.
ENTRYPOINT [ "node", "/srv/login" ]

# Expose ports.
EXPOSE 2440
