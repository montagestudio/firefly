#!/bin/bash

PIDFILE="/var/run/haproxy.pid"
CONFIG="/etc/haproxy/haproxy.cfg"

exec haproxy -f "$CONFIG" -p "$PIDFILE"