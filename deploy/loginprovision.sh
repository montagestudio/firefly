#!/usr/bin/env bash


# Port 80 to Firefly port
export FIREFLY_PORT="2440"
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $FIREFLY_PORT

