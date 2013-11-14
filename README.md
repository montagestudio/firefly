Firefly
=======

Firefly parallels the Beacon neé Lumieres project as another host for the 
Filament application.

Firefly will serve Filament itself for use inside a browser and also provide
services access to services for consumption in Filament much like Beacon does
through its associated Environment Bridge.

Contributing
============
- Run `jshint` on your code to ensure it conforms to Filament standards

- Make sure all commit messages follow the 50 character subject/72 character
body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

- Make sure commit messages start with uppercase present tense commands
e.g. Prefer "Clear selection when clicking templateExplorer" over
"Cleared selection when clicking templateExplorer"

Updating dependencies
---------------------

The dependencies are checked in [as recomended](http://www.futurealoof.com/posts/nodemodules-in-git.html)
by members of the community. To update them run:

```bash
npm run update-dependencies
```

This will remove all the existing dependencies, install and dedupe, and stage
the node_modules. At this point you should test and rollback any dependencies
that you don't want to update.
