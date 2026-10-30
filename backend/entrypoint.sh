#!/bin/bash
set -e

# Wait for database to be ready with retries
wait_for_db() {
    local max_retries=30
    local retry_interval=2
    local retries=0
    
    echo "Waiting for database to be ready..."
    
    while [ $retries -lt $max_retries ]; do
        if pg_isready -h postgres -p 5432 -U lifeos -d lifeos > /dev/null 2>&1; then
            echo "Database is ready!"
            return 0
        fi
        retries=$((retries + 1))
        echo "Database not ready yet. Retry $retries/$max_retries..."
        sleep $retry_interval
    done
    
    echo "ERROR: Database did not become ready in time"
    exit 1
}

# Run migrations with retries
run_migrations() {
    local max_retries=10
    local retry_interval=3
    local retries=0
    
    echo "Running database migrations..."
    
    while [ $retries -lt $max_retries ]; do
        if alembic upgrade head; then
            echo "Migrations completed successfully!"
            return 0
        fi
        retries=$((retries + 1))
        echo "Migration failed. Retry $retries/$max_retries..."
        sleep $retry_interval
    done
    
    echo "ERROR: Migrations failed after $max_retries retries"
    exit 1
}

# Main execution
wait_for_db
run_migrations

# Start the application
exec "$@"