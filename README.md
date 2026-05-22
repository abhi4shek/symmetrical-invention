# Doc Chat

A full-stack RAG chatbot for chatting with PDF documents.

The app uses a FastAPI backend, React/Vite frontend, Groq for LLM responses, Supabase Postgres for app data, Supabase Storage for PDFs, and Qdrant Cloud for vector search.

## Features

- Email/password authentication with JWT
- PDF upload and text extraction
- Per-user document records and chat history
- Cloud vector search with Qdrant
- PDF backup storage with Supabase Storage
- React dashboard with light and dark modes

## Free Deployment Stack

- Frontend: Vercel Hobby
- Backend: Render Free Web Service
- Database: Supabase Free Postgres
- File storage: Supabase Free Storage
- Vector database: Qdrant Cloud Free
- LLM: Groq free tier
- Embeddings: HuggingFace Inference API

## Local Setup

Backend:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

Create `.env` in the project root from `.env.example`.

For local testing you still need `QDRANT_URL`, `QDRANT_API_KEY`, `GROQ_API_KEY`, and `INFERENCE_API_KEY`. `DATABASE_URL=sqlite:///./backend.db` is fine locally.

## Run Locally

Start the backend:

```bash
venv\Scripts\activate
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open:

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

## Deploy Online For Free

### 1. Create Free Services

Create these accounts/projects:

- GitHub repo with this code
- Supabase project
- Qdrant Cloud free cluster
- Render account
- Vercel account

### 2. Supabase Setup

In Supabase:

1. Create a new project.
2. Go to **Project Settings > Database** and copy the pooler connection string.
3. Create a Storage bucket named:

```text
documents
```

4. Go to **Project Settings > API** and copy:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Use the service role key only on the backend.

### 3. Qdrant Setup

In Qdrant Cloud:

1. Create a free cluster.
2. Copy the cluster URL.
3. Create/copy an API key.

The backend creates the `doc_chat_chunks` collection automatically on first upload.

### 4. Render Backend

Create a new Render **Web Service** from this GitHub repo.

Use:

```text
Root Directory: .
Build Command: pip install -r requirements.txt
Start Command: uvicorn backend.app:app --host 0.0.0.0 --port $PORT
Health Check Path: /health
```

Add Render environment variables:

```env
GROQ_API_KEY=your_groq_key
INFERENCE_API_KEY=your_huggingface_token
DEFAULT_GROQ_MODEL=llama-3.1-8b-instant
SECRET_KEY=your_long_random_secret
DATABASE_URL=your_supabase_postgres_pooler_url
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=doc_chat_chunks
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=documents
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

If Supabase gives a URL starting with `postgres://`, the backend normalizes it automatically.

### 5. Vercel Frontend

Import the same GitHub repo in Vercel.

Use:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

Add Vercel environment variable:

```env
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```

The included `frontend/vercel.json` keeps React Router routes working after refresh.

After Vercel gives you the final frontend URL, update Render:

```env
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

Then redeploy the Render backend.

## Project Structure

```text
backend/       FastAPI app, auth, database, RAG utilities
frontend/      React TypeScript UI
requirements.txt
.env.example
```

## Notes

- Render free services sleep after inactivity, so first requests can be slow.
- Do not commit `.env`.
- Supabase service role keys must never be exposed in frontend code.
- Free-tier quotas are enough for demos and portfolio projects, not heavy production traffic.
