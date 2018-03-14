# Services

This directory contains the source for all docker services.

`npm install` and `npm test` in the project root will install/test all directories that have a `package.json`. `npm run build` will build the docker images for all directories that have a `Dockerfile`.

Services should symlink the `common/` directory if they need access to shared code.
