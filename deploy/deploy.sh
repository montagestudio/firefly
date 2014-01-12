ssh -o "ForwardAgent yes" montage@198.211.98.185 <<EOF
# print commands and exit on non-zero exit code
set -xe

if [ ! -d /srv/jenkins ]; then mkdir -p /srv/jenkins; fi
cd /srv/jenkins

update ()
{
  # \$1 is directory
  # \$2 is commit hash

  # if the repo isn't cloned then do that...
  if [ ! -d \$1 ];
    then
      git clone git@github.com:declarativ/\$1.git;
      pushd \$1
        git config user.name "Declarativ Bot"
        git config user.email dev@declarativ.com
      popd
  fi

  pushd \$1
    # if commit hash is set then check it out
    if [ "\$2" ];
    then
      git fetch
      git checkout "\$2"
      # Rebuild binary modules
      npm rebuild
    fi
    # Tag every deploy regardless of whether the code was updated or not
    git tag -a -m "$BUILD_URL" "deploy-$BUILD_NUMBER"
    #git push --tags
  popd
}

update filament $FILAMENT_COMMIT
update firefly $FIREFLY_COMMIT

# allow non-zero exit code from naught status
set +e

naught status
if [ \$? -eq 1 ];
then
  naught start --cwd /srv/jenkins/firefly/ firefly/index.js --client=../filament
else
  naught deploy
fi
EOF
