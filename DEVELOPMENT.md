# Local Development Setup

This guide will help you run the Context Marketplace locally with hot reloading for development.

## Quick Start

### ⚡ Super Easy Method (Recommended)
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start both servers with one command
./start-dev.sh
```

This starts both backend (port 3000) and frontend (port 5173) automatically!

### 🔧 Manual Method (Alternative)
```bash
# Terminal 1 - Backend
npm run dev:http

# Terminal 2 - Frontend  
npm run dev:frontend
```

### 🚀 All-in-one NPM Script
```bash
npm run dev:full
```

## Accessing the Application

- **3D Graph Viewer**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

## Available Scripts

### Development
- `npm run dev:full` - Run both backend and frontend with hot reloading
- `npm run dev:http` - Run only the backend server
- `npm run dev:frontend` - Run only the frontend dev server

### Building
- `npm run build` - Build both backend (TypeScript) and frontend (React)
- `npm run build:frontend` - Build only the frontend

### Production
- `npm run start:web` - Start the built web server (serves both API and built frontend)

## Development Features

### Hot Reloading
- Frontend changes automatically reload in the browser
- Backend changes restart the server automatically (with tsx)

### API Integration
- Frontend automatically connects to `localhost:3000` in development
- CORS is configured for local development
- API client includes retry logic and error handling

### 3D Graph Visualization
- Interactive 3D graph with Three.js and React Three Fiber
- Multiple layout algorithms (Force-directed, Circular, Hierarchical)
- Real-time node manipulation and layout persistence
- Professional UI with keyboard shortcuts

## Environment Variables

Create a `.env` file in the root directory:

```bash
# Database (optional - falls back to file storage)
DATABASE_URL=postgresql://username:password@localhost:5432/modelit

# Storage directory
MODELIT_STORAGE_DIR=./models

# Frontend dev mode
FRONTEND_DEV=true
```

Create `frontend/.env` for frontend-specific variables:

```bash
# Override API URL if needed
VITE_API_BASE_URL=http://localhost:3000
```

## Database Setup (Optional)

If you want to use PostgreSQL instead of file storage:

```bash
# Install PostgreSQL locally
brew install postgresql  # macOS
# or use Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

# Set DATABASE_URL in .env
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/modelit" > .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

## Keyboard Shortcuts (in 3D Viewer)

- `Ctrl+1` - Force-directed layout
- `Ctrl+2` - Circular layout  
- `Ctrl+3` - Hierarchical layout
- `Ctrl+?` - Show help
- `Escape` - Clear selection

## Troubleshooting

### Frontend not connecting to backend
- Check that backend is running on `http://localhost:3000`
- Verify CORS settings allow `localhost:5173`
- Check browser console for API errors

### Database connection issues
- Verify DATABASE_URL is correct
- Run `npx prisma generate` after schema changes
- Check if PostgreSQL is running

### Build issues
- Clear node_modules: `rm -rf node_modules frontend/node_modules`
- Reinstall: `npm install && cd frontend && npm install`
- Check TypeScript errors: `npm run typecheck`

## Project Structure

```
├── src/                   # Backend TypeScript source
│   ├── mcp/              # MCP server implementation  
│   ├── models/           # Data models
│   ├── storage/          # Database and file storage
│   └── web-server.ts     # Web server entry point
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   └── api/          # API client
│   └── dist/             # Built frontend (after npm run build)
├── dist/                 # Built backend (after npm run build)
└── models/               # Model storage directory
```