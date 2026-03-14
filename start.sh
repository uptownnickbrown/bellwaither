#!/bin/bash
# Meridian Platform - Development Startup Script
# Starts both the backend API and frontend dev server

echo "Starting Meridian Platform..."
echo "================================"

# Check PostgreSQL
if ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL..."
  sudo pg_ctlcluster 16 main start 2>/dev/null
fi

# Backend
echo "Starting backend API (port 8000)..."
cd backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Frontend
echo "Starting frontend (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "================================"
echo "Meridian is running!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "================================"

# Trap to kill both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
