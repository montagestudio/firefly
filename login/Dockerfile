# Firefly Login
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM firefly
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

COPY login/ /srv/
COPY common/ /srv/login/
# COPY ../filament /srv/

# Define default command.
ENTRYPOINT [ "node", "/srv/login", "-c", "/srv/filament" ]

# Expose ports.
EXPOSE 2440
