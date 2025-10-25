#!/bin/bash

echo "🚀 Starting Context Marketplace Development Environment"
echo ""
echo "This will start both the backend (port 3000) and frontend (port 5173)"
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    jobs -p | xargs -r kill
    exit 0
}

# Set trap to cleanup on exit
trap cleanup INT TERM

# Start backend server in background
echo "📡 Starting backend server on http://localhost:3000..."
FRONTEND_DEV=true npm run dev:http &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend server in background  
echo "🎨 Starting frontend server on http://localhost:5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait a moment then show URLs
sleep 3
echo ""
echo "✅ Both servers are running!"
echo ""
echo "🌐 Frontend (3D Graph Viewer): http://localhost:5173"
echo "📡 Backend API: http://localhost:3000/api"
echo "❤️  Health Check: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for all background jobs
wait