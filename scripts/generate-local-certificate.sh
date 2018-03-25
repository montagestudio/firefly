#!/bin/bash

pushd ssl
    echo "Generating CA certificate and key..."
    if [ -e "cacert.pem" ]; then
        echo "Already exists, moving on"
    else
        openssl req -x509 -config openssl-ca.cnf -newkey rsa:4096 -sha256 -nodes -out cacert.pem -outform PEM
        touch index.txt
        echo '01' > serial.txt
    fi

    echo "Generating certificate request..."
    openssl req -config openssl-server.cnf -newkey rsa:2048 -sha256 -nodes -keyout serverkey.pem -out servercert.csr -outform PEM

    echo "Signing certificate with local CA..."
    openssl ca -config openssl-ca.cnf -policy signing_policy -extensions signing_req -out servercert.pem -infiles servercert.csr

    echo "Combining cert and key into single pem file..."
    openssl x509 -in servercert.pem > cert.pem
    cat cert.pem serverkey.pem > local.montage.studio.pem
    rm cert.pem
popd
