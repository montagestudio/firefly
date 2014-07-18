# Sandstorm

* Checkout `firefly` and `filament` to the `sandstorm` branch.
* Clone sandstorm next to `firefly` and `filament`:
* 
    ```bash
    git clone git@github.com:sandstorm-io/sandstorm.git
    cd sandstorm/
    ```

* Edit the Vagrant file to include:

    ```
    config.vm.synced_folder "../firefly", "/home/vagrant/firefly"
    config.vm.synced_folder "../filament", "/home/vagrant/firefly/filament"
    ```
* Run `vagrant up`
* Go to http://localhost:6080/
* Sign in > Configure GitHub Login
* Add details:
    - Client ID: `8a5a299f19d19455f8fc`
    - Client Secret: `4c031d98e60ef89de0af95cb738d540c48c49532`
    - These are owned by Stuk, you may want to create your own app
* Sign in with GitHub
* In the terminal

    ```bash
    vagrant ssh
    sudo apt-get update
    sudo apt-get install nodejs
    sudo apt-get install npm
    cd /home/vagrant/firefly
    sudo spk dev
    ```
    
* Now at http://localhost:6080/ you can create an instance of the Example app

What works:
* The basic server

What doesn't work:
* Everything else
* Because of the security model apps can't make external requests by default. At the time of writing https://github.com/sandstorm-io/sandstorm/blob/master/src/sandstorm/hack-session.capnp provides a temporary interface.

What needs to be done:
* Use capnproto to connect to Sandstorm's APIs
* Use these APIs to make requests to the outside world/GitHub
* Everything else
