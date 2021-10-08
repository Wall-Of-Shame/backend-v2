# Wall of Shame Backend

## Description

This backend was initialised via [Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Setup

### Database - Postgres

1. Ensure you have Postgres 13 on your computer and running.
1. Note down the following:

- A postgres user and their password used to login to Postgres.
- The name of a database instance within Postgres belonging to that user.
- A schema within that database to create the tables in.
- The port and url of the database. Defaults to `localhost:5432`.

You can consider using `pgadmin` to manage the data and database migrations.

### NodeJs

1. Ensure you have NodeJs on your computer, above Node 12.
1. Run `yarn install` to install the dependencies.
1. Create a `.env` file containing the private application ids and database connection setting. using `.env.example` for a template.
1. Run `yarn prisma:generate` to get the type definitions for the Prisma ORM.
1. Run `yarn prisma:deploy` to load the tables.
1. Run `yarn start:dev` to start up the server.

Optional: You can seed the database with `yarn prisma db seed`.

## Common Commands

`yarn start:dev`
Starts the server instance and listens for incoming calls.

### Prisma-Specific Commands

`yarn prisma:generate`
After changing the `prisma/schema.prisma` file, run this command to load the latest type definitions.

`yarn prisma migrate dev`
After changing the `prisma/schema.prisma` file, run this command to generate the sql commands to modify the underlying table(s).

`yarn prisma studio`
View and manage data in the connected database instance.
