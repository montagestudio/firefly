#!/usr/bin/env bash

set -e

apt-get update --fix-missing

apt-get install --yes lxc

# Enable a swap file to get better usage of the memory
declare SWAPON=`swapon -s | grep swapfile`
if [[ -z ${SWAPON} ]]; then
    echo "Creating a swap file"
    dd if=/dev/zero of=/swapfile bs=1024 count=2048k
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile       none    swap    sw      0       0 " >> /etc/fstab
    echo 10 | tee /proc/sys/vm/swappiness
    echo vm.swappiness = 10 | tee -a /etc/sysctl.conf
    chown root:root /swapfile
    chmod 0600 /swapfile
else
    echo "Error swap file already active"
    exit 1
fi

# Configure cgroup to get the stats
# echo "cgroup  /sys/fs/cgroup  cgroup  defaults                        0       0" >> /etc/fstab
sed -i.bak 's/GRUB_CMDLINE_LINUX_DEFAULT=*/GRUB_CMDLINE_LINUX_DEFAULT="quiet cgroup_enable=memory swapaccount=1"/' /etc/default/grub
update-grub

# Install Docker
curl -sL https://get.docker.io/ | sh
