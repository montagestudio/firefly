#!/usr/bin/env bash
# Script to clone a Declarativ repository

if [[ $GITHUBDECLARATIV == "" ]]; then
    export GITHUBDECLARATIV="github.com"
fi

get ()
{
  # $1 is directory
  # $2 is branch name

  BRANCH=
  if [ "$2" ]; then
    BRANCH="$2"
  fi

  rm -rf "${BUILD}/$1"
  git clone git@$GITHUBDECLARATIV:declarativ/$1.git "${BUILD}/$1"
  if [[ -e "${BUILD}/$1" ]]; then
    pushd "${BUILD}/$1"
        git config user.name "Declarativ Bot"
        git config user.email dev@declarativ.com

        # if branch is set then check it out
        if [ "${BRANCH}" ]; then
            echo "checkout branch ${BRANCH} for ${1}"
            git checkout "${BRANCH}"
        fi

        # Tag every deploy
        # git tag -a -m "$BUILD_URL" "deploy-$BUILD_NUMBER"
        # git push --tags

        # Create a file with the git hash so that given just an image we know what
        # code is in it
        git rev-parse HEAD > GIT_HASH

        # Remove git directory before uploading to server to reduce size
        rm -rf .git

        # Remove test code
        rm -rf test
        rm -rf spec
    popd
    pushd "${BUILD}"
        tar -czf "$1.tgz" "$1"
    popd
  else
      echo "Cannot clone git repository: "${BUILD}/$1
      exit -1
  fi
}

get-clean ()
{
  # $1 is directory

  pushd "${BUILD}"
    rm -rf "$1"
    rm -rf "$1.tgz"
  popd
}

tag ()
{
    # $1 is directory
    # $2 is tag name
    # $3 is branch name
 
    TAG=
    if [ "$2" ]; then
      TAG="$2"
    fi
    BRANCH=
    if [ "$3" ]; then
      BRANCH="$3"
    fi
    
    rm -rf "${BUILD}/$1"
    git clone git@$GITHUBDECLARATIV:declarativ/$1.git "${BUILD}/$1"
    if [[ -e "${BUILD}/$1" ]]; then
      pushd "${BUILD}/$1"
          git config user.name "Declarativ Bot"
          git config user.email dev@declarativ.com

          # if branch is set then check it out
          if [ "${BRANCH}" ]; then
              echo "checkout branch ${BRANCH} for ${1}"
              git checkout "${BRANCH}"
          fi

          # Tag every deploy
          git tag -a -m "Build Aurora Images" "$TAG"
          git push --tags
      popd
      rm -rf "${BUILD}/$1"
    else
        echo "Cannot clone git repository: "${BUILD}/$1
        exit -1
    fi
    
}

get-image-id ()
{
    echo `tugboat info_image -n "$1" | grep ID: | sed 's/ID:[ ]*\([0-9]*\)/\1/'`
}

build-base-image ()
{
    declare BASE_IMAGE_ID=`get-image-id "$1-$BUILD_RELEASE_NAME"`
    if [[ -z ${BASE_IMAGE_ID} ]]; then
        echo "The base image $1 must be build before the current image"
        ${HOME}/deploy/build/$1.sh
        BASE_IMAGE_ID=`get-image-id "$1-$BUILD_RELEASE_NAME"`
        if [[ -z ${BASE_IMAGE_ID} ]]; then
            echo "Error building the base image $1-$BUILD_RELEASE_NAME"
            exit 1
        fi
    fi
}

remove-image ()
{
    declare IMAGE_EXIST=`tugboat info_image "$1" | grep Name`
    if [[ -n ${IMAGE_EXIST} ]]; then
        tugboat destroy_image "$1" -c
    fi
}

get-release-number ()
{
    if [[ $LAST_BUILD_NUMER < 0 ]]; then
        if [[ -n ${BUILD_RELEASE_NAME} ]]; then

            rm -rf "${BUILD}/firefly"
            git clone git@$GITHUBDECLARATIV:declarativ/firefly.git "${BUILD}/firefly"
            if [[ -e "${BUILD}/firefly" ]]; then
                pushd "${BUILD}/firefly"
                    TAG_EXIST=`git tag -l "${BUILD_RELEASE_NAME}/*"`
                    if [[ -n ${TAG_EXIST} ]]; then
                        LAST_BUILD=`git tag -l "${BUILD_RELEASE_NAME}/*" | sed s@[^/]*/@@ | sort -n | tail -n 1`
                        if [[ -n $LAST_BUILD ]]; then
                            export LAST_BUILD_NUMER=$LAST_BUILD
                            export BUILD_REVISION_NUMBER=$LAST_BUILD
                        else
                            echo "Malformed tag name ${TAG_EXIST}"
                            exit -1
                        fi
                    else
                        export LAST_BUILD_NUMER=0
                        export BUILD_REVISION_NUMBER=0
                    fi
                export TAG_NAME="$BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER"
                popd
                rm -rf "${BUILD}/firefly"
            else
                echo "Cannot clone git repository: ${BUILD}/firefly"
                exit -1
            fi
        else
                echo "The Release name must be set: "
                exit -1
        fi
    fi

}