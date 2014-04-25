Firefly deployment
==================

To go from zero-to-images run `./deploy/build/setup.sh`. This will install `packer` and `tugboat` in the .deploy directory. To use packer and tugboat you will need to setup the environemnt and the best way to do it is to do `source ./deploy/build/env.sh`. You can then run tugboat or packer. In order to ssh into the images you will need to insert your public key in ./deploy/files/authorized_keys.

To build all the images for deployment on Digital Ocean run `./deploy/build/images.sh`

The deployment process employs two kinds of scripts. The scripts in the `build`
directory are run on the developer’s box. The build scripts orchestrate the
creation of images on Digital Ocean, ultimately using `packer`, using a
`build/*-image.json` configuration files. Packer then copies configuration files
from `files` and `services`, and executes scripts from `provision` on the
Digital Ocean dropplet, ultimately taking a snapshot of the resulting dropplet
to produce an image (`.iso`).

Finally `build/rebuild.sh` copies images over the file systems of the production
or staging dropplets and reboots them.

The build scripts generate images corresponding to clean checkouts of Firefly
and Filament. These versions are tagged in Git like `hera2/1`. For each build,
the next tag is automatically inferred by checking the highest tag in Git and
incrementing the last number.

The image production process has stages where it will create “base” images from
which other images will be created. The `base-image.sh` produces an image from
which all other images are generated and only needs to be changed to update the
Ubuntu version or equally pervasive changes. The remaining `*-image.sh` scripts
build upon the base image for each of the server roles including all software
but none of the application specific configuration.

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
