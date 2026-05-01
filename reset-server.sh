#!/bin/bash
PID=$(lsof -ti :3000)
if [ -n "$PID" ]; then
  echo "Killing process $PID on port 3000..."
  kill "$PID"
  sleep 1
fi
npm run dev
