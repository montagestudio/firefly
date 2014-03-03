#!/usr/bin/env bash

if [[ -e /etc/haproxy/haproxy.cfg  ]]; then
    sudo sed -i.bak 's/server static1 [0-9\.]*/server static1 107.170.66.81/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server login1 [0-9\.]*/server login1 107.170.71.152/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server login2 [0-9\.]*/server login2 162.243.44.160/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/use-server project3 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/use-server project4 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project1 [0-9\.]+/server project1 107.170.33.167/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project2 [0-9\.]+/server project2 107.170.69.149/' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project3 .*//' /etc/haproxy/haproxy.cfg
    sudo sed -i.bak 's/server project4 .*//' /etc/haproxy/haproxy.cfg
    
    sudo service haproxy reload
fi

if [[ -e /etc/init/firefly-login.conf ]]; then
    sudo sed -i.bak 's/export NODE_ENV=.*/export NODE_ENV="staging"/' /etc/init/firefly-login.conf
    sudo sed -i.bak 's/export GITHUB_CLIENT_ID=.*/export GITHUB_CLIENT_ID="0f96f18f7f6bbc1d9ce8"/' /etc/init/firefly-login.conf
    sudo sed -i.bak 's/export GITHUB_CLIENT_SECRET=.*/export GITHUB_CLIENT_SECRET="b1150aa26598295d6ca75fc651943def8954ab44"/' /etc/init/firefly-login.conf
    sudo sed -i.bak 's/export FIREFLY_APP_URL=.*/export FIREFLY_APP_URL=https:\/\/staging-aurora.montagestudio.com/' /etc/init/firefly-login.conf
    sudo sed -i.bak 's/export FIREFLY_PROJECT_URL=.*/export FIREFLY_PROJECT_URL=http:\/\/staging-project.montagestudio.com/' /etc/init/firefly-login.conf
    sudo sed -i.bak 's/export FIREFLY_PROJECT_SERVER_COUNT=.*/export FIREFLY_PROJECT_SERVER_COUNT=2/' /etc/init/firefly-login.conf

    sudo service firefly-login reload
fi

if [[ -e /etc/init/firefly-project.conf ]]; then
    sudo sed -i.bak 's/export NODE_ENV=.*/export NODE_ENV="staging"/' /etc/init/firefly-project.conf
    sudo sed -i.bak 's/export GITHUB_CLIENT_ID=.*/export GITHUB_CLIENT_ID="0f96f18f7f6bbc1d9ce8"/' /etc/init/firefly-project.conf
    sudo sed -i.bak 's/export GITHUB_CLIENT_SECRET=.*/export GITHUB_CLIENT_SECRET="b1150aa26598295d6ca75fc651943def8954ab44"/' /etc/init/firefly-project.conf
    sudo sed -i.bak 's/export FIREFLY_APP_URL=.*/export FIREFLY_APP_URL=https:\/\/staging-aurora.montagestudio.com/' /etc/init/firefly-project.conf
    sudo sed -i.bak 's/export FIREFLY_PROJECT_URL=.*/export FIREFLY_PROJECT_URL=http:\/\/staging-project.montagestudio.com/' /etc/init/firefly-project.conf
    sudo sed -i.bak 's/export FIREFLY_PROJECT_SERVER_COUNT=.*/export FIREFLY_PROJECT_SERVER_COUNT=2/' /etc/init/firefly-project.conf

    sudo service firefly-project reload
fi
