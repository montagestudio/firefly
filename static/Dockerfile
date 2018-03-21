# Firefly Project Daemon
#
# VERSION 1.1

FROM nginx:latest
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

COPY static/nginx.conf /etc/nginx/nginx.conf
COPY static/filament /srv/app
COPY common/inject/adaptor /srv/app/adaptor
