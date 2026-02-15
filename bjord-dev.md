Going to use Podman to spin up dev envs without requiring root
Create a podman image of postgres for testing:
podman run --rm -d --name imageboard-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=imageboard postgres:16
