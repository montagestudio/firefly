cp /vagrant/deploy/files/redis-sentinel.conf /etc/redis/redis-sentinel.conf

sed -i.bak 's/sentinel monitor master [0-9\.]*/sentinel monitor master 10.0.0.4/' /etc/redis/redis-sentinel.conf
