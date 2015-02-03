#!/usr/bin/env bash

set -e

apt-get update --fix-missing
apt-get dist-upgrade -y

# Curl
apt-get install -y curl

# Add the "add-apt-repository" command
apt-get update
apt-get install --yes python-software-properties python g++ make software-properties-common

# Create the montage user that the server will run under
adduser --disabled-password --gecos "" admin
adduser admin sudo
mkdir -p /home/admin/.ssh
if [[ -e "/tmp/authorized_keys" ]]; then
    cp /tmp/authorized_keys /home/admin/.ssh/authorized_keys
fi
chown -R admin:admin /home/admin/.ssh/

# Create the montage user that the server will run under
adduser --disabled-password --gecos "" montage
mkdir -p /home/montage/.ssh
if [[ -e "/tmp/authorized_keys" ]]; then
    cp /tmp/authorized_keys /home/montage/.ssh/authorized_keys
fi
chown -R montage:montage /home/montage/.ssh/

rm -rf /tmp/authorized_keys

# Move the sudoers file to the correct place
mv "/tmp/sudoers" "/etc/sudoers.d/sudoers"
# Verify the permissions on the sudoers file
if [[ -e "/etc/sudoers.d/sudoers" ]]; then
    chmod 0440 "/etc/sudoers.d/sudoers"
    chown root:root "/etc/sudoers.d/sudoers"
fi

# Create the clone directory
mkdir -p /srv
chown -R montage:montage /srv

# Install Serf from http://www.serfdom.io/
#
apt-get install --yes zip
pushd /tmp
    SERF="0.6.2_linux_amd64.zip"
    curl -LO https://dl.bintray.com/mitchellh/serf/${SERF}
    unzip ${SERF}
    rm -rf ${SERF}
    mv serf /usr/bin/.
popd

# Install and configure new relic agent
#
echo deb http://apt.newrelic.com/debian/ newrelic non-free >> /etc/apt/sources.list.d/newrelic.list
wget -O- https://download.newrelic.com/548C16BF.gpg | apt-key add -
apt-get update
apt-get install newrelic-sysmond
nrsysmond-config --set license_key=a2660b5f44eb7caf56d40c2002b3e53d4301f76b

