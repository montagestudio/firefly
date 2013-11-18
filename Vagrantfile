Vagrant.configure('2') do |config|
  config.vm.provider :digital_ocean do |provider, override|
    override.ssh.private_key_path = '~/.ssh/id_rsa'
    override.vm.box = 'digital_ocean'
    override.vm.box_url = "https://github.com/smdahlen/vagrant-digitalocean/raw/master/box/digital_ocean.box"

    provider.client_id = 'MvpCvMEQ3SzzrktRn9UN5'
    provider.api_key = '3a1486fbd43dbd19396f33741cbe8c60'

    provider.region = 'San Francisco 1'

    provider.ca_path = "/usr/local/homebrew/opt/curl-ca-bundle/share/ca-bundle.crt"

    config.vm.hostname = "firefly"

    config.ssh.username = "montage"

    config.vm.synced_folder ".", "/srv/firefly",
        owner: "montage", group: "montage"
    config.vm.synced_folder "../filament", "/srv/filament",
        owner: "montage", group: "montage"

    config.vm.provision :shell, :path => "provision.sh"
  end
end
