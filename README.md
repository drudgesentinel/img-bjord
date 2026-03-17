This is an image board written in Javascript.

The goal is to make it easy to host, and easy to use.

.env should contain your DB URL, something like:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imageboard

For tests, use a separate database as tests will blow out db contents:
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imageboard_test

Also supported for compatibility in tests: `TEST_DATABASE` or `DATABASE_URL_TEST`.

You can do basic configuration of the board at:
frontend/src/lib/siteConfig.ts

At some point, I'm going to add additional options here. idk what.

You need podman installed for things to work out of the box

`./bjdev db up` now initializes both `imageboard` and `imageboard_test` databases and applies `db/schema.sql` to each.

============

To get off the ground, you need to reverse proxy to this app behind nginx or whatever.

Then, you need to provision and admin user and create some boards (which you can do at /admin)