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