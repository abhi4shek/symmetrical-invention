# Doc Chat

A first-version full-stack RAG chatbot for chatting with PDF documents.

The app uses a FastAPI backend, a React/Vite frontend, Groq for LLM responses, and FAISS for document retrieval.

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite, LangChain, FAISS
- Frontend: React, TypeScript, Vite, Tailwind CSS
- AI: Groq API and HuggingFace embeddings

## Features

- Email/password authentication with JWT
- PDF upload and text extraction
- Per-user document indexing
- Document-aware chat with conversation history
- Light and dark UI modes

## Setup

### Backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Environment

Create a `.env` file in the project root. Use `.env.example` as a reference.

Required values:

```env
GROQ_API_KEY=your_groq_key
INFERENCE_API_KEY=your_huggingface_key
SECRET_KEY=your_secret_key
BACKEND_URL=http://localhost:8000
DATABASE_URL=sqlite:///./backend.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Run

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

## Project Structure

```text
backend/       FastAPI app, auth, database, RAG utilities
frontend/      React TypeScript UI
data/          Runtime vector stores
requirements.txt
.env.example
```

## Notes

- Upload PDF files from the frontend after signing in.
- API keys are required for document embedding and chat responses.
- Runtime files such as the SQLite database and vector stores are local development data.
