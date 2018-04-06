# Firefly Project Daemon
#
# VERSION 1.1

FROM firefly
LABEL author="Corentin Debost <corentin.debost@kaazing.com>"

RUN apt-get update
RUN apt-get install -y nginx

# Configure SSH so we can clone from private repos
RUN apt-get install -y openssh-server
RUN mkdir /root/.ssh
COPY ssl/id_rsa /root/.ssh/id_rsa
RUN echo "    IdentityFile /root/.ssh/id_rsa" >> /etc/ssh/ssh_config
RUN echo "    StrictHostKeyChecking=no" >> /etc/ssh/ssh_config

COPY static/nginx.conf /etc/nginx/nginx.conf
COPY static/filament /srv/app
RUN npm install --prefix /srv/app/
# TODO Fix in montage
RUN npm install --prefix /srv/app/node_modules/montage
COPY common/inject/adaptor /srv/app/adaptor

CMD nginx -g 'daemon off;'
