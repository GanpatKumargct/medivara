// PM2 process file for MediVara (backend, frontend, DB studio) on one machine.
//
// First time only:
//   docker compose up -d                       # PostgreSQL on 127.0.0.1:5433 (docker-compose.yml)
//   (create the read-only Studio role once: see db-studio/README.md)
//   cd backend && uv sync && cp -n .env.example .env && uv run python -m app.seed reset && cd ..
//   cd Frontend && npm ci && cd ..
//   cd db-studio && npm ci && cp -n .env.example .env && cd ..
// Then:
//   pm2 start ecosystem.config.cjs     # start all three
//   pm2 status medivara                # or: pm2 logs medivara
//   pm2 restart medivara               # e.g. after changing AI_MODE in backend/.env
//   pm2 stop medivara / pm2 delete medivara
//
// Frontend: http://localhost:5173 (Vite proxies /api/v1 to the backend)
// Backend:  http://localhost:8000/api/v1/health · Swagger at /api/v1/docs
// Database: Prisma Studio (read-only) at http://localhost:5555
//
// The backend reads backend/.env (GEMINI_API_KEY, AI_MODE, DEMO_MODE, …). Its own log lines
// are allow-listed (no health data); uvicorn's access log is off because it would print
// raw paths and query strings.

const path = require("node:path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "medivara-backend",
      namespace: "medivara",
      cwd: path.join(root, "backend"),
      script: "uv",
      args: "run --frozen uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 2000,
      kill_timeout: 5000,
      watch: false,
      time: true,
      out_file: path.join(root, "logs", "backend.out.log"),
      error_file: path.join(root, "logs", "backend.err.log"),
      merge_logs: true,
    },
    {
      // Prisma Studio, read-only view of the PostgreSQL database: http://localhost:5555
      name: "medivara-db-studio",
      namespace: "medivara",
      cwd: path.join(root, "db-studio"),
      script: "npm",
      args: "run studio",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 2000,
      watch: false,
      time: true,
      out_file: path.join(root, "logs", "db-studio.out.log"),
      error_file: path.join(root, "logs", "db-studio.err.log"),
      merge_logs: true,
    },
    {
      name: "medivara-frontend",
      namespace: "medivara",
      cwd: path.join(root, "Frontend"),
      script: "npm",
      args: "run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 2000,
      watch: false,
      time: true,
      out_file: path.join(root, "logs", "frontend.out.log"),
      error_file: path.join(root, "logs", "frontend.err.log"),
      merge_logs: true,
    },
  ],
};
