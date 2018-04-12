# Getting Started

## Installation

 1. Install Docker 17.05.x+.

 2. Install docker-compose 1.19.0+.

 3. Use npm v4: `nvm use 4`.

 4. Initialize submodules: `git submodule init && git submodule update`.

 5. `npm install`.

### Create a swarm

For ease of development, Firefly is deployed locally in a swarm running natively on the guest OS. First, initialize a swarm with a single node (your machine):

```
docker swarm init
```

If the command complains about not being able to choose an IP address to advertise, choose your main IP address (check `ifconfig`) and specify it as your advertise address as follows:

```
docker swarm init --advertise-addr <YOUR_IP>
```

### Add a swarm visualizer

For ease of debugging and inspecting the swarm, you may add a swarm visualizer service to a cluster manager node. The visualizer provides a UI to see the different nodes in your swarm, see which services are running where, and what the status of every container is. Create the visualizer:

```
docker service create -d --name swarm-visualizer \
  -p 5001:8080 \
  --mount type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock \
  dockersamples/visualizer
```

This will create a web application at 127.0.0.1:5001. You can use this to see which services are currently deployed.

### Enabling HTTPS in development

Firefly is served locally over https. In order to have the browser trust local.montage.studio, create a local CA and a a signed cert with:

```
npm run generate-local-certificate
```

This uses the configuration files in `ssl/` to create a certificate + private key for a local CA (named Kaazing Local) and a `local.montage.studio.pem` file for use in the load balancer. Next, Chrome needs to be told about this certificate authority so that it trusts its certificates:

#### Linux

Open the certificate settings in chrome (chrome://settings/certificates). Open the "Authorities" tab, click "IMPORT", and select the `cacert.pem` file that was just generated in `ssl/`. Finally, restart Chrome. 

#### MacOS

Open `ssl/` in Finder and double-click the `local.montage.studio.pem` file. This will add the certificate to Keychain Access. Make sure that this certificate was added to the System chain. Next, double-click the added "Montage Studio" certificate in Keychain Access. Open the "Trust" section and set the "When using this certificate:" option to "Always Trust". If refreshing the page does not turn the security icon green, type in `chrome://restart` to restart the browser.


Now the browser will trust the certificate and will allow loading Firefly over https. Importing the CA certificate only needs to be done once, as the script will not re-create the `cacert.pem` file if it already exists. If you generate a new certificate after running the stack, you must redeploy at least the traefik service.

If you need to add a new domain to Firefly, add the domain under the "[ alternate names ]" section of `ssl/openssl-server.cnf` and run `npm run generate-local-certificate` again.

### Deploy

Run the following to pull all needed service images. If you don't have these images locally then they will be pulled when you deploy each service, which means you will have to wait a while on the first run:

```
docker-compose -f traefik-stack.yml pull
docker-compose -f firefly-stack.yml pull
docker-compose -f project-daemon/user-stacks/basic-stack.yml pull
```

Run `npm start` to deploy the traefik stack and the firefly stack to the swarm. Use `docker service ls` to list all services and see how many replicas of each service are up.

The app is available at https://local.montage.studio:2440/.
A swarm visualizer is available at http://local.montage.studio:2441/.
A traefik control panel is available at http://local.montage.studio:2442/.

Use `npm stop` to remove both stacks from the swarm.
