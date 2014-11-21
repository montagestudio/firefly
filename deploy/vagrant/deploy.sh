#!/bin/sh

echo Deploy login
vagrant ssh login -c 'sudo naught deploy --override-env false /home/montage/naught.ipc || (tail -n 20 /home/montage/stderr.log && exit 1)'

echo
echo Stop containers
vagrant ssh project -c 'sudo su -c "docker ps -a -q | xargs --no-run-if-empty docker stop"'

echo
echo Deploy project
vagrant ssh project -c 'sudo naught deploy --override-env false /home/montage/naught.ipc || (tail -n 20 /home/montage/stderr.log && exit 1)'
