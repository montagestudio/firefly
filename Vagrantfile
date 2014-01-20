Vagrant.configure('2') do |config|
    config.vm.box = "precise64"
    config.vm.box_url = "http://files.vagrantup.com/precise64.box"

    config.vm.provision "shell", path: "deploy/provision/base.sh"


    config.vm.define "web-server" do |web|
        web.vm.hostname = "web-server"
        web.vm.network "forwarded_port", guest: 80, host: 8080

        web.vm.provision "shell", path: "deploy/provision/web-server.sh"

        web.vm.synced_folder "../filament", "/srv/filament"
        web.vm.synced_folder "inject/adaptor", "/srv/filament/adaptor"

        web.vm.provision :shell, :inline => "cp /vagrant/deploy/services/nginx.conf /etc/nginx/nginx.conf"

        # TODO put in JSON image
        web.vm.provision :shell, :inline => "nginx"
    end

    config.vm.define "login" do |login|
        login.vm.hostname = "login"
        login.vm.network "forwarded_port", guest: 2440, host: 8081

        # TODO don't mount filament when server is split
        login.vm.synced_folder "../filament", "/srv/filament"
        login.vm.synced_folder ".", "/srv/firefly"

        login.vm.provision "shell", path: "deploy/provision/login.sh"

        login.vm.provision :shell, :inline => "cp /vagrant/deploy/services/firefly.conf /etc/init/firefly.conf"

        # TODO put in JSON image
        login.vm.provision :shell, :inline => "initctl reload-configuration"
        login.vm.provision :shell, :inline => "service firefly start"
    end

end
