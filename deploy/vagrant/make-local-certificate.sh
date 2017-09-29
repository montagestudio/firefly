#!/bin/bash

# Generates a certificate for the local-project domain. Needed to dev with
# https. The script requires sudo access and will prompt for certificate
# details.

DOMAIN="local-project.montagestudio.com"

pushd deploy/files/
    sudo openssl genrsa -out $DOMAIN.key 2048
    sudo openssl req -new -sha256 \
        -config openssl.cnf \
        -key $DOMAIN.key \
        -subj "/C=US/ST=California/L=San Jose/O=Kaazing/CN=*.local-project.montagestudio.com" \
        -reqexts SAN \
        -out $DOMAIN.csr
    sudo openssl x509 -req \
        -days 365 \
        -in $DOMAIN.csr \
        -signkey $DOMAIN.key \
        -out $DOMAIN.crt
    cat $DOMAIN.crt $DOMAIN.key > $DOMAIN.pem
    sudo rm $DOMAIN.crt $DOMAIN.key
popd