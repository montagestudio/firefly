#!/bin/sh

vagrant ssh login -c 'sudo naught deploy --override-env false /home/montage/naught.ipc || (tail -n 20 /home/montage/stderr.log && exit 1)' &&
vagrant ssh project -c 'sudo naught deploy --override-env false /home/montage/naught.ipc || (tail -n 20 /home/montage/stderr.log && exit 1)'
