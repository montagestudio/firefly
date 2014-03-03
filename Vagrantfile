Vagrant.configure('2') do |config|
    config.vm.box = "precise64"
    config.vm.box_url = "http://files.vagrantup.com/precise64.box"

    if Vagrant.has_plugin?("vagrant-cachier")
        # Only enable `apt` as I don't trust npm and what will happen if we
        # cache those packages
        config.cache.enable :apt
    end

    # The base install does an upgrade of all packages but we do not want grub to be updated on the VM as it fails
    config.vm.provision :shell, inline: "echo 'grub-pc hold' | dpkg --set-selections"
    config.vm.provision :shell, path: "deploy/provision/base.sh"
    config.vm.provision :shell, inline: "/etc/init.d/vboxadd setup"

    # The machines listed below should match as closely as possible the Packer
    # .json images. Try and keep the steps in the same order as in the .json
    # files to make comparison easier.
    #
    # Ports and private IPs
    #
    # Each VM should have a private IP in the `10.0.0.x` subnet
    #
    #   NAME.vm.network "private_network", ip: "10.0.0.2"
    #
    # If the VM exposes a service then forward that port out so that it can be
    # hit directly for debugging. It should be of the form `818x`, where `x` is
    # the same as the final part of the IP (just to make things easier).
    #
    #   NAME.vm.network "forwarded_port", guest: 80, host: 8182
    #
    # Synced directories
    #
    # The filament and firefly directories should be mounted using
    # `synced_folder` so that as the developer updates their files they are
    # updated in the VMs as well
    #
    #   NAME.vm.synced_folder ".", "/srv/firefly"
    #   NAME.vm.synced_folder "../filament", "/srv/filament"
    #
    # Config files
    #
    # It's not possible to share a single file, so they must be copied onto
    # the machine. In the VM the `/vagrant` path is the root of this directory
    # and so this is where you can copy from:
    #
    #   NAME.vm.provision :shell, inline: "cp /vagrant/deploy/files/EXAMPLE /etc/EXAMPLE"
    #
    # Running services
    #
    # Any services you expect to be running must be started at the bottom of
    # each VM's config, as the VM must be usable without a reboot. Services
    # should start themselves automatically on reboot, but the provisioning
    # scripts should already be doing that for the production servers.

    config.vm.define "load-balancer" do |lb|
        lb.vm.hostname = "load-balancer"
        lb.vm.network "private_network", ip: "10.0.0.2"
        lb.vm.network "forwarded_port", guest: 80, host: 8182
        # Exposed so that existing URL works
        lb.vm.network "forwarded_port", guest: 80, host: 2440

        lb.vm.provision :shell, inline: "cp /vagrant/deploy/files/30-haproxy.conf /etc/rsyslog.d/30-haproxy.conf"
        lb.vm.provision :shell, inline: "cp /vagrant/deploy/files/montagestudio.com.pem /etc/ssl/montagestudio.com.pem"
        lb.vm.provision :shell, inline: "cp /vagrant/deploy/files/project.montagestudio.net.pem /etc/ssl/project.montagestudio.net.pem"

        lb.vm.provision :shell, path: "deploy/provision/load-balancer.sh"

        lb.vm.provision :shell, inline: "cp /vagrant/deploy/files/haproxy.cfg /etc/haproxy/haproxy.cfg"

        # Change the haproxy config for this development environment. If you
        # change any of the following lines make sure to update the bit about
        # HAProxy in the readme as well
        # Disable the ssl redirect
        lb.vm.provision :shell, inline: "sed -i.bak 's/redirect scheme https .*//' /etc/haproxy/haproxy.cfg"
        #   login
        lb.vm.provision :shell, inline: "sed -i.bak 's/server login1 [0-9\.]*/server login1 10.0.0.4/' /etc/haproxy/haproxy.cfg"
        lb.vm.provision :shell, inline: "sed -i.bak 's/server login2 .*//' /etc/haproxy/haproxy.cfg"
        #   web-server
        lb.vm.provision :shell, inline: "sed -i.bak 's/server static1 [0-9\.]*/server static1 10.0.0.3/' /etc/haproxy/haproxy.cfg"

        lb.vm.provision :shell, inline: "sed -i.bak 's/use-server .*//' /etc/haproxy/haproxy.cfg"
        #   project
        lb.vm.provision :shell, inline: "sed -i.bak 's/server project1 [0-9\.]*/server project1 10.0.0.5/' /etc/haproxy/haproxy.cfg"
        lb.vm.provision :shell, inline: "sed -i.bak 's/server project2 .*//' /etc/haproxy/haproxy.cfg"
        lb.vm.provision :shell, inline: "sed -i.bak 's/server project3 .*//' /etc/haproxy/haproxy.cfg"
        lb.vm.provision :shell, inline: "sed -i.bak 's/server project4 .*//' /etc/haproxy/haproxy.cfg"

        lb.vm.provision :shell, inline: "cp -R /vagrant/deploy/files/errors/* /etc/haproxy/errors"

        # Start
        # HAProxy uses rsyslog. It needs to be restarted to pick up the
        # configuration change
        lb.vm.provision :shell, :inline => "service rsyslog restart"
        lb.vm.provision :shell, :inline => "service haproxy start || service haproxy reload"
    end

    config.vm.define "web-server" do |web|
        web.vm.hostname = "web-server"
        web.vm.network "private_network", ip: "10.0.0.3"
        web.vm.network "forwarded_port", guest: 80, host: 8183

        web.vm.provision :shell, path: "deploy/provision/web-server.sh"

        web.vm.synced_folder "../filament", "/srv/app"
        web.vm.synced_folder "inject/adaptor", "/srv/app/adaptor"

        web.vm.provision :shell, :inline => "cp /vagrant/deploy/files/nginx.conf /etc/nginx/nginx.conf"

        # Using sendfile with remote filesystems (like the Vagrant mounted one)
        # is not reliable. Turn it off. Thanks https://coderwall.com/p/ztskha
        web.vm.provision :shell, inline: "sed -i.bak 's/sendfile on/sendfile off/' /etc/nginx/nginx.conf"

        # Start
        web.vm.provision :shell, :inline => "nginx || nginx -s reload"
    end

    config.vm.define "login" do |login|
        login.vm.provision :shell, path: "deploy/provision/base-additions.sh"

        login.vm.hostname = "login"
        login.vm.network "private_network", ip: "10.0.0.4"
        login.vm.network "forwarded_port", guest: 2440, host: 8184
        # For node-inspector
        login.vm.network "forwarded_port", guest: 8104, host: 8104
        login.vm.provision :shell, :inline => "npm install -g node-inspector"
        # Install and configure rinetd to make nodejs debugging available
        # externally
        login.vm.provision :shell, :inline => "sudo apt-get install rinetd"
        login.vm.provision :shell, :inline => "sudo sh -c \"echo '10.0.0.4 5858 127.0.0.1 5858' >> /etc/rinetd.conf\""
        login.vm.provision :shell, :inline => "sudo /etc/init.d/rinetd restart"

        # TODO don't mount filament when server is split
        login.vm.synced_folder "../filament", "/srv/filament"
        login.vm.synced_folder ".", "/srv/firefly"

        login.vm.provision :shell, path: "deploy/provision/login.sh"

        login.vm.provision :shell, :inline => "cp /vagrant/deploy/services/firefly-login.conf /etc/init/firefly-login.conf"
        login.vm.provision :shell, inline: "sed -i.bak 's/export NODE_ENV=.*//' /etc/init/firefly-login.conf"
        login.vm.provision :shell, inline: "sed -i.bak 's/export GITHUB_CLIENT_ID=.*//' /etc/init/firefly-login.conf"
        login.vm.provision :shell, inline: "sed -i.bak 's/export GITHUB_CLIENT_SECRET=.*//' /etc/init/firefly-login.conf"
        login.vm.provision :shell, inline: "sed -i.bak 's/export FIREFLY_APP_URL=.*//' /etc/init/firefly-login.conf"
        login.vm.provision :shell, inline: "sed -i.bak 's/export FIREFLY_PROJECT_URL=.*//' /etc/init/firefly-login.conf"
        login.vm.provision :shell, inline: "sed -i.bak 's/export FIREFLY_PROJECT_SERVER_COUNT=.*/export FIREFLY_PROJECT_SERVER_COUNT=1/' /etc/init/firefly-login.conf"


        # Start
        login.vm.provision :shell, :inline => "service firefly-login start || service firefly-login reload"
    end

    config.vm.define "project" do |project|
        project.vm.provision :shell, path: "deploy/provision/base-additions.sh"

        project.vm.hostname = "project"
        project.vm.network "private_network", ip: "10.0.0.5"
        project.vm.network "forwarded_port", guest: 2440, host: 8185
        # For node-inspector
        project.vm.network "forwarded_port", guest: 8105, host: 8105
        project.vm.provision :shell, :inline => "npm install -g node-inspector"
        # Install and configure rinetd to make nodejs debugging available
        # externally
        project.vm.provision :shell, :inline => "sudo apt-get install rinetd"
        project.vm.provision :shell, :inline => "sudo sh -c \"echo '10.0.0.5 5858 127.0.0.1 5858' >> /etc/rinetd.conf\""
        project.vm.provision :shell, :inline => "sudo /etc/init.d/rinetd restart"

        # TODO don't mount filament when server is split
        project.vm.synced_folder "../filament", "/srv/filament"
        project.vm.synced_folder ".", "/srv/firefly"

        project.vm.provision :shell, :inline => "ln -sf /srv/firefly/Dockerfile /srv/Dockerfile"

        project.vm.provision :shell, path: "deploy/provision/project.sh"

        project.vm.provision :shell, :inline => "cp /vagrant/deploy/services/firefly-project.conf /etc/init/firefly-project.conf"
        project.vm.provision :shell, inline: "sed -i.bak 's/export NODE_ENV=.*//' /etc/init/firefly-project.conf"
        project.vm.provision :shell, inline: "sed -i.bak 's/export GITHUB_CLIENT_ID=.*//' /etc/init/firefly-project.conf"
        project.vm.provision :shell, inline: "sed -i.bak 's/export GITHUB_CLIENT_SECRET=.*//' /etc/init/firefly-project.conf"
        project.vm.provision :shell, inline: "sed -i.bak 's/export FIREFLY_APP_URL=.*//' /etc/init/firefly-project.conf"
        project.vm.provision :shell, inline: "sed -i.bak 's/export FIREFLY_PROJECT_URL=.*//' /etc/init/firefly-project.conf"
        project.vm.provision :shell, inline: "sed -i.bak 's/export FIREFLY_PROJECT_SERVER_COUNT=.*/export FIREFLY_PROJECT_SERVER_COUNT=1/' /etc/init/firefly-login.conf"

        # Start
        project.vm.provision :shell, :inline => "service firefly-project start || service firefly-project reload"
    end

end
