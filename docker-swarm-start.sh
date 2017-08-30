# Init Swarm
docker swarm init

# Create docker swarm registry
docker service create --name docker-registry --publish 5000:5000 registry:2
docker ps | grep -q registry:2

# To visualize Docker Swarm and Services Status 
# Install image bellow, then visit (http://localhost:5001/)
docker run -it -d -p 5001:8080 -v /var/run/docker.sock:/var/run/docker.sock dockersamples/visualizer

# Start services to check docker-compose.yml
docker-compose rm
docker-compose up -d --build

# Stop services 
docker-compose down --volumes
docker-compose stop

# Push to docker swarm registry
#docker-compose push
docker stack deploy --compose-file docker-compose.yml firefly
docker stack services firefly
