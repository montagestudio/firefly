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

end
