This image board will contain multiple simple components- the ultimate goal is to containerize the individual components so that the app can be easily deployed on Kubernetes/Docker.

Component 1: The API
Thread/post CRUD
Serve JSON to Frontend
Create/modify DB records

Component 2: The DB

Component 3: The Frontend

Component 4: Object Storage
The plan is to have an S3 compatible storage system

The frontend and backend are separated into separate services as they can venerate logs/restart independently, and should theoretically allow me to isolate failures more easily.

Disk usage reporting choice (admin view):
- Prefer Node's `fs.statfs()` over wrapping `df`.
- `statfs` returns structured numeric values directly, so we avoid brittle text parsing (`df -h` unit changes, locale differences, column formatting differences).
- It avoids spawning subprocesses, which reduces overhead and removes shell-escaping/injection concerns.
- It is more predictable in containers/minimal images where `df` may be missing or behave differently.
- We can measure the exact filesystem path the app uses (for example, upload storage path) and return consistent bytes for UI formatting.