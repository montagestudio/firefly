#!/usr/bin/env bash

set -e

if [[ -e /etc/haproxy/haproxy.cfg  ]]; then
    sudo sed -i.bak 's/project.montagestudio.net.pem/staging-project.montagestudio.net.pem/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server static1 [0-9\.]*/server static1 107.170.66.81/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server login1 [0-9\.]*/server login1 107.170.71.152/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server login2 [0-9\.]*/server login2 162.243.44.160/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/use-server project3 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/use-server project4 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project1 [0-9\.]\+/server project1 107.170.33.167/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project2 [0-9\.]\+/server project2 107.170.69.149/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project3 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project4 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/stats show-desc .*/stats show-desc Montage Studio Staging Statistic Page/' /etc/haproxy/haproxy.cfg

    sudo service haproxy reload
fi

if [[ -e /srv/app/track.js ]]; then
    sudo sed -i.bak 's/var ENVIRONMENT = .*;/var ENVIRONMENT = "staging";/' /srv/app/track.js
fi

if [[ -e /etc/init/firefly-login.conf ]]; then
    mv -f "/srv/firefly/staging.env" "/srv/firefly/.env"
    sudo restart firefly-login
fi

if [[ -e /etc/init/firefly-project.conf ]]; then
    mv -f "/srv/firefly/staging.env" "/srv/firefly/.env"
    sudo restart firefly-project
fi
