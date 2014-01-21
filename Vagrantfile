Vagrant.configure('2') do |config|
    config.vm.box = "precise64"
    config.vm.box_url = "http://files.vagrantup.com/precise64.box"

    config.vm.provision "shell", path: "deploy/provision/base.sh"

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
    # hit directly for debugging. It should be of the form `808x`, where `x` is
    # the same as the final part of the IP (just to make things easier).
    #
    #   NAME.vm.network "forwarded_port", guest: 80, host: 8082
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
    #   NAME.vm.provision "shell", inline: "cp /vagrant/deploy/files/EXAMPLE /etc/EXAMPLE"
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
        lb.vm.network "forwarded_port", guest: 80, host: 8082

        lb.vm.provision "shell", inline: "cp /vagrant/deploy/files/30-haproxy.conf /etc/rsyslog.d/30-haproxy.conf"

        lb.vm.provision "shell", path: "deploy/provision/load-balancer.sh"

        lb.vm.provision "shell", inline: "cp /vagrant/deploy/files/haproxy.cfg /etc/haproxy/haproxy.cfg"

        # Change the haproxy config for this development environment
        #   login
        lb.vm.provision "shell", inline: "sed -i.bak 's/server login1 [0-9\.]*/server login1 10.0.0.4/' /etc/haproxy/haproxy.cfg"
        lb.vm.provision "shell", inline: "sed -i.bak 's/server login2 .*//' /etc/haproxy/haproxy.cfg"
        #   web-server
        lb.vm.provision "shell", inline: "sed -i.bak 's/server filament1 [0-9\.]*/server filament1 10.0.0.3/' /etc/haproxy/haproxy.cfg"

        # Start
        lb.vm.provision :shell, :inline => "service rsyslog restart"
        lb.vm.provision :shell, :inline => "service haproxy start || service haproxy reload"
    end

    config.vm.define "web-server" do |web|
        web.vm.hostname = "web-server"
        web.vm.network "private_network", ip: "10.0.0.3"
        web.vm.network "forwarded_port", guest: 80, host: 8083

        web.vm.provision "shell", path: "deploy/provision/web-server.sh"

        web.vm.synced_folder "../filament", "/srv/filament"
        web.vm.synced_folder "inject/adaptor", "/srv/filament/adaptor"

        web.vm.provision :shell, :inline => "cp /vagrant/deploy/services/nginx.conf /etc/nginx/nginx.conf"

        # Start
        web.vm.provision :shell, :inline => "nginx || nginx -s reload"
    end

    config.vm.define "login" do |login|
        login.vm.hostname = "login"
        login.vm.network "private_network", ip: "10.0.0.4"
        login.vm.network "forwarded_port", guest: 2440, host: 8084

        # TODO don't mount filament when server is split
        login.vm.synced_folder "../filament", "/srv/filament"
        login.vm.synced_folder ".", "/srv/firefly"

        login.vm.provision "shell", path: "deploy/provision/login.sh"

        login.vm.provision :shell, :inline => "cp /vagrant/deploy/services/firefly.conf /etc/init/firefly.conf"

        # Start
        login.vm.provision :shell, :inline => "service firefly start || service firefly reload"
    end

end
