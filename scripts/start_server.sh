#!/bin/bash
# Start CAPS Full Stack

echo "Starting CAPS Backend..."
export PYTHONPATH=$PYTHONPATH:$(pwd)/src
# Run server.py in background
python3 -m caps.server &
BACKEND_PID=$!

echo "Starting CAPS Frontend..."
cd frontend
npm run dev

# Cleanup on exit
kill $BACKEND_PID
