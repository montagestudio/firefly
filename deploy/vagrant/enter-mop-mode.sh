#!/usr/bin/env bash -x
# normal mode: root /srv
# mop mode:    root /vagrant/.deploy/srv
vagrant ssh web-server -c "sudo sed -i.bak -E 's@(\\s*root).*@\\1 /vagrant/.deploy/srv;@' /etc/nginx/nginx.conf && sudo nginx -s reload"
# normal mode: login.vm.synced_folder "../filament", "/srv/filament"
# mop mode:    login.vm.synced_folder ".deploy/builds", "/srv"
sed -i.bak -E 's@(login.vm.synced_folder) "../filament".*@\1 ".deploy/builds", "/srv"@' Vagrantfile
vagrant reload login
