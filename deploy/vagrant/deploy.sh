#!/bin/sh

# Deploy login
vagrant ssh login -c 'sudo naught deploy --override-env false /home/montage/naught.ipc || (tail -n 20 /home/montage/stderr.log && exit 1)'
# Stop containers
vagrant ssh project -c 'sudo su -c "docker ps -a -q | xargs --no-run-if-empty docker stop"'
# Deploy project
vagrant ssh project -c 'sudo naught deploy --override-env false /home/montage/naught.ipc || (tail -n 20 /home/montage/stderr.log && exit 1)'
