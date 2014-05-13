cp /vagrant/deploy/files/haproxy.cfg /etc/haproxy/haproxy.cfg

# Disable the ssl redirect
sed -i.bak 's/redirect scheme https .*//' /etc/haproxy/haproxy.cfg

# login
sed -i.bak 's/server login1 [0-9\.]*/server login1 10.0.0.4/' /etc/haproxy/haproxy.cfg
sed -i.bak 's/server login2 .*//' /etc/haproxy/haproxy.cfg

# web-server
sed -i.bak 's/server static1 [0-9\.]*/server static1 10.0.0.3/' /etc/haproxy/haproxy.cfg

sed -i.bak 's/use-server .*//' /etc/haproxy/haproxy.cfg

# project
sed -i.bak 's/server project1 [0-9\.]*/server project1 10.0.0.5/' /etc/haproxy/haproxy.cfg
sed -i.bak 's/server project2 .*//' /etc/haproxy/haproxy.cfg
sed -i.bak 's/server project3 .*//' /etc/haproxy/haproxy.cfg
sed -i.bak 's/server project4 .*//' /etc/haproxy/haproxy.cfg

# redis
sed -i.bak 's/server redis1 [0-9\.]*/server redis1 10.0.0.4/' /etc/haproxy/haproxy.cfg
sed -i.bak 's/server redis2 .*//' /etc/haproxy/haproxy.cfg
