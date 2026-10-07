# Backup system frontend

This Next.js App Router application is the interface for the Express backup API. The repository's main [README](../README.md) describes the complete system and Docker setup.

## Run locally

Start the backend stack from the repository root with `docker compose up --build -d`. The frontend is available at <http://localhost:3002>.

For frontend development, run `npm ci` and `npm run dev -- --port 3002` here. Set `INTERNAL_API_URL=http://localhost:3000` and `INTERNAL_TOKEN` in a local, ignored `frontend/.env.local`; copy the token from your existing root `.env`. The browser never needs either value. The `frontend/.env.example` file lists the supported server settings.

## Request flow

The browser calls same-origin Next.js route handlers. They forward public requests to Express with the JWT from an HttpOnly cookie. Admin route handlers check the current user and add `INTERNAL_TOKEN` only on the server. File bytes and metadata remain managed by Express, PostgreSQL, Kafka workers, and storage nodes.

Run `npm run build` and `npm run lint` to check the frontend.
