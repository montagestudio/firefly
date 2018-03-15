#!/bin/bash

# Installs filament into the static/ directory if it isn't already there

if [ ! -e 'static/filament' ]; then
    git clone git@github.com:montagestudio/filament static/filament
fi

npm install --prefix static/filament
