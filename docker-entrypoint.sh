#!/bin/sh
# Applies any pending Prisma migrations, then hands off to the real
# container command (`node server.js` from CMD in the Dockerfile).
# Safe to run on every container start: `migrate deploy` is a no-op when
# the database is already up to date.
set -e

echo "expense-billing-app: applying database migrations..."
node_modules/.bin/prisma migrate deploy

echo "expense-billing-app: starting server..."
exec "$@"
