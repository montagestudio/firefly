# Getting Started

## Installation

 1. Install Docker 17.05.x+: https://docs.docker.com/install/.

 2. Open the Docker Preferences from the task bar icon. Go to Advanced and set the Memory allocation to at least 6 GB. Then click the "Apply & Restart" button to restart the Docker daemon.

 3. Install docker-compose 1.19.0+: https://docs.docker.com/compose/install/.

 4. Initialize submodules: `git submodule init && git submodule update`.

 5. `npm install` to get the jshint dependency required to lint the codebase.

### Enabling HTTPS in development

Firefly is served locally over https. In order to have the browser trust local.montage.studio, create a local CA and a a signed cert with:

```
npm run generate-local-certificate
```

This uses the configuration files in `traefik/ssl/` to create a certificate + private key for a local CA (named Kaazing Local) and a `local.montage.studio.pem` file for use in the load balancer. Next, Chrome needs to be told about this certificate authority so that it trusts its certificates:

#### Linux

Open the certificate settings in chrome (chrome://settings/certificates). Open the "Authorities" tab, click "IMPORT", and select the `cacert.pem` file that was just generated in `traefik/ssl/`. Finally, restart Chrome. 

#### MacOS

Open `traefik/ssl/` in Finder and double-click the `local.montage.studio.pem` file. This will add the certificate to Keychain Access. Make sure that this certificate was added to the System chain. Next, double-click the added "Montage Studio" certificate in Keychain Access. Open the "Trust" section and set the "When using this certificate:" option to "Always Trust". If refreshing the page does not turn the security icon green, type in `chrome://restart` to restart the browser.


Now the browser will trust the certificate and will allow loading Firefly over https. Importing the CA certificate only needs to be done once, as the script will not re-create the `cacert.pem` file if it already exists. If you generate a new certificate after running the stack, you must redeploy at least the traefik service.

If you need to add a new domain to Firefly, add the domain under the "[ alternate names ]" section of `traefik/ssl/openssl-server.cnf` and run `npm run generate-local-certificate` again.

### Start

Run `npm run build` and then `npm start`.

The app is available at https://local.montage.studio:2440/.
A traefik control panel is available at http://local.montage.studio:2442/.

Use `npm stop` to remove all containers.
