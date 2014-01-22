Firefly deployment
==================

To go from zero-to-images run `./deploy/build/setup.sh`. This will install `packer` and `tugboat` in the .deploy directory. To use packer and tugboat you will need to setup the environemnt and the best way to do it is to do `source ./deploy/build/env.sh`. You can then run tugboat or packer. I order to ssh into the images you will need to insert your public key in ./deploy/files/authorized_keys.

To build all the images for deployment on Digital Ocean run `./deploy/build/images.sh`

## Directories

### build/

Run one of these scripts to start the build of an image.

### files/

Configuration files to be copied into the images.

### provision/

Scripts that are run inside of a new VM to set up all the packages and code that are needed.

### services/

These are configuration files for [Upstart](http://upstart.ubuntu.com/), to launch services when a machine boots. See the [manual](http://upstart.ubuntu.com/cookbook/).

### ../.deploy/

This directory is created in the root of firefly to store the `packer` and `tugboat` binaries
