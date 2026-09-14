# 🚀 Railway Docker Deployment Guide — Referral Guardian

This guide provides step-by-step instructions for deploying **Referral Guardian** (FastAPI/LangGraph Backend and Next.js 16 Frontend) to [Railway](https://railway.app) using **Docker**.

---

## 🏗️ Architecture & Services Overview

Referral Guardian is split into two containerized services on Railway:

1. **`referral-guardian-backend`**: FastAPI Python service running LangGraph agent workflows, statutory 20-day compliance checks, and API endpoints.
2. **`referral-guardian-frontend`**: Next.js 16 App Router web interface.
3. **Database**: PostgreSQL (Railway PostgreSQL Plugin or Supabase PostgreSQL URI).

---

## 🛠️ Method 1: Deployment via Railway Web Dashboard (Recommended)

### Step 1: Create a Railway Project
1. Log in to [Railway](https://railway.app).
2. Click **New Project** $\to$ **Deploy from GitHub repo**.
3. Select the `Referal_Guardian` repository.

---

### Step 2: Deploy the Backend Service (`referral-guardian-backend`)

1. Click **+ New** in your Railway project canvas $\to$ **GitHub Repo** $\to$ select `Referal_Guardian`.
2. Go to **Settings** of the new service:
   - **Service Name**: `referral-guardian-backend`
   - **Root Directory**: `backend`
   - **Build**: Set to **Dockerfile** (uses `backend/Dockerfile`).
3. Under **Networking**:
   - Click **Generate Domain** (e.g. `https://referral-guardian-backend-production.up.railway.app`).
4. Under **Variables**:
   - `DATABASE_URL`: Your PostgreSQL connection string (e.g. `postgresql://postgres:password@db.supabase.co:5432/postgres` or Railway Postgres variable `${{Postgres.DATABASE_URL}}`).
   - `OPENAI_API_KEY`: *(Optional)* Your OpenAI/OpenRouter API key for live LLM reasoning. (Defaults to mock reasoning engine if omitted).
   - `CORS_ORIGINS`: Allowed origins (e.g. `https://referral-guardian-frontend-production.up.railway.app`).

---

### Step 3: Deploy the Frontend Service (`referral-guardian-frontend`)

1. Click **+ New** in your Railway project canvas $\to$ **GitHub Repo** $\to$ select `Referal_Guardian`.
2. Go to **Settings**:
   - **Service Name**: `referral-guardian-frontend`
   - **Root Directory**: `frontend`
   - **Build**: Set to **Dockerfile** (uses `frontend/Dockerfile`).
3. Under **Variables**:
   - `NEXT_PUBLIC_API_URL`: The generated Railway backend domain from Step 2 (e.g. `https://referral-guardian-backend-production.up.railway.app`).
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase publishable anon key.
4. Under **Networking**:
   - Click **Generate Domain** (e.g. `https://referral-guardian-frontend-production.up.railway.app`).

> [!IMPORTANT]
> Because Next.js compiles `NEXT_PUBLIC_*` variables into client-side JS bundles during build time, ensure `NEXT_PUBLIC_API_URL` is configured under Railway Variables *before* trigger builds!

---

## 💻 Method 2: Deployment via Railway CLI

If you prefer deploying directly from your local terminal using the Railway CLI:

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Link to your Railway project
railway link

# 4. Deploy Backend
cd backend
railway up --service referral-guardian-backend

# 5. Deploy Frontend
cd ../frontend
railway up --service referral-guardian-frontend
```

---

## 🔑 Environment Variables Reference

### Backend (`/backend`)
| Variable | Description | Required | Default |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `sqlite:///./app.db` (Local) |
| `PORT` | Dynamic port injected by Railway | Automatic | `8000` |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins | Optional | Wildcard / Railway regex |
| `OPENAI_API_KEY` | Key for GPT-4/3.5 models | Optional | Built-in Mock LLM Engine |
| `OPENROUTER_API_KEY` | Key for OpenRouter models | Optional | None |

### Frontend (`/frontend`)
| Variable | Description | Required | Default |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | FastAPI Backend public Railway URL | Yes | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | Default Supabase Instance |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon publishable key | Yes | Default Key |
| `PORT` | Dynamic port injected by Railway | Automatic | `3000` |

---

## 🧪 Local Docker Build Verification

You can test build the Docker containers locally prior to pushing:

```bash
# Build Backend Docker Image
docker build -t referral-guardian-backend ./backend

# Run Backend Container
docker run -p 8000:8000 -e PORT=8000 referral-guardian-backend

# Build Frontend Docker Image with Arguments
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  -t referral-guardian-frontend ./frontend

# Run Frontend Container
docker run -p 3000:3000 -e PORT=3000 referral-guardian-frontend
```
