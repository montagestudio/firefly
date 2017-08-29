#!/usr/bin/env bash -x

HERE="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" && pwd )"

FIREFLY_PATH="$(dirname -- "$(dirname "${HERE}")")"
FILAMENT_PATH="$(dirname -- "${FIREFLY_PATH}")/filament"

FIREFLY_ISH="$(cd -- "${FIREFLY_PATH}"; git rev-parse HEAD)"
FILAMENT_ISH="$(cd -- "${FILAMENT_PATH}"; git rev-parse HEAD)"
COMBINED_ISH="${FILAMENT_ISH:0:8}${FIREFLY_ISH:0:8}"

FILAMENT_INTERMEDIATE_PATH="$FIREFLY_PATH/.deploy/sources/$COMBINED_ISH"
FILAMENT_BUILDS_PATH="$FIREFLY_PATH/.deploy/builds"
FILAMENT_ARCHIVE="${FIREFLY_PATH}/.deploy/filament.tgz"

if [ ! -e "$FIREFLY_PATH"/.deploy/srv ]; then
    mkdir -p -- "$FIREFLY_PATH"/.deploy/srv
    (cd -- "$FIREFLY_PATH"/.deploy/srv; ln -s ../builds/filament app)
fi

# consider mop mode
if [ ! "$MOP" ]; then
    # default
    #MOP="$FILAMENT_PATH/node_modules/.bin/mop"
    # debug
    #MOP="node $FIREFLY_PATH/../mop/optimize.js -o 0"
    # XXX stopgap debug
    MOP="node $FIREFLY_PATH/deploy/build/fakemop.js"
fi

# Capture a snapshot of Filament in an intermediate location
mkdir -p -- "$FILAMENT_INTERMEDIATE_PATH"
echo "$FILAMENT_ISH" > "${FILAMENT_INTERMEDIATE_PATH}/GIT_HASH"
(
    cd -- "$FILAMENT_PATH";
    git archive "$FILAMENT_ISH"
) \
| (
    cd -- "${FILAMENT_INTERMEDIATE_PATH}";
    tar xf -
) || exit -1

# Overlay the Firefly adaptor for Filament on the intermediate files
mkdir -p -- "${FILAMENT_INTERMEDIATE_PATH}/adaptor"
(
    cd -- "${FIREFLY_PATH}";
    # extract only the "inject/adaptor" directory from Firefly.
    git archive "$FIREFLY_ISH" inject/adaptor
) \
| (
    cd -- "${FILAMENT_INTERMEDIATE_PATH}";
    tar --strip=1 -xf -
    # --strip=1 removes the "inject" prefix from each of the archived files.
) || exit -1

# Mop the combined Filament overlays
(
    cd -- "$FILAMENT_INTERMEDIATE_PATH";
    $MOP -t "$FILAMENT_BUILDS_PATH"
) || exit -1

mkdir -p -- "$FIREFLY_PATH"

# Archive it for deployment
mkdir -p -- "$FIREFLY_PATH/.deploy"
(
    cd -- "${FILAMENT_BUILDS_PATH}/filament";
    find . -print0 \
        | xargs -0 bsdtar --disable-copyfile -czf "$FILAMENT_ARCHIVE"
        # --disable-copyfile is a little-known, hard to find directive that
        # tells tar not to use the underlying copyfile C lib function, which
        # causes Mac OS extended attributes (formerly resource forks) as "._"
        # prefixed files in tar archives. These usually get round tripped to OS
        # X file systems, but are just trash elsewhere.
) || exit -1

