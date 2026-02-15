Going to use Podman to spin up dev envs without requiring root
Create a podman image of postgres for testing:
podman run --rm -d --name imageboard-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=imageboard postgres:16

for raku scripts, i should aim to bring the system to a specific state, as opposed to
running commands and strictly handling the resulting output