#!/bin/sh

# $1: Main domain
# $2: Project domain
# $3: Contact email

add-apt-repository ppa:certbot/certbot
apt-get update
apt-get install -y certbot

# Generate certificate
service haproxy stop
certbot certonly -n \
    --standalone \
    --preferred-challenges http \
    --http-01-port 80 \
    --agree-tos \
    -d "$1" \
    -d "$2" \
    -d www."$2" \
    -m "$3"

# Move certificates into haproxy
mkdir -p /etc/haproxy/certs
cat /etc/letsencrypt/live/"$1"/fullchain.pem /etc/letsencrypt/live/"$1"/privkey.pem > /etc/haproxy/certs/"$1".pem
service haproxy start
