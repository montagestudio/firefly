# Firefly Login
#
# VERSION 1.1

# TODO move to 16.04 LTS
FROM firefly
MAINTAINER Harold Thetiot <harold.thetiot@montagestudio.com>

COPY login/ /srv/login/
COPY common/ /srv/login/common/

# Define default command.
ENTRYPOINT [ "node", "/srv/login" ]

# Expose ports.
EXPOSE 2440
