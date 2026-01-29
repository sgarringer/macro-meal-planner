#!/bin/sh
set -e

# Ensure upload and data directories exist (SQLite file will auto-create)
mkdir -p /app/backend/uploads

# Execute the main container command
exec "$@"
