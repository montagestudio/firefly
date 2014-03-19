#!/bin/bash

set -e

# Install necessary libraries for guest additions and Vagrant NFS Share
sudo apt-get -y -q install linux-headers-$(uname -r) build-essential dkms nfs-common

# Install necessary dependencies
sudo apt-get -y -q install wget

# Add "vagrant" to the "admin" group to give it sudo
usermod -a -G admin vagrant

# Installing vagrant keys
mkdir ~/.ssh
chmod 700 ~/.ssh
cd ~/.ssh
wget --no-check-certificate 'https://raw.github.com/mitchellh/vagrant/master/keys/vagrant.pub' -O authorized_keys
chmod 600 ~/.ssh/authorized_keys
chown -R vagrant ~/.ssh

# I have no idea why, but installing the guest addittions does not work. So,
# instead let's not install them and let the `vagrant-vbguest` plugin handle
# them.

# Install guest additions
# mount -o loop $HOME/VBoxGuestAdditions_*.iso /mnt
# /mnt/VBoxLinuxAdditions.run --nox11
# umount /mnt
