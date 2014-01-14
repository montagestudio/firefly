Firefly deployment
==================

To go from zero-to-images run `./build/setup.sh`. This will install `packer` and `tugboat` in the .deploy directory.

## Directories

### build/

Run one of these scripts to start the build of an image.

### provision/

Scripts that are run inside of a new VM to set up all the packages and code that are needed.

### ../.deploy/

This directory is created in the root of firefly to store the `packer` and `tugboat` binaries
