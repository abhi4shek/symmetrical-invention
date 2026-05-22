import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload

from . import auth, models, schemas, util
from .database import Base, engine, get_db

# Load environment variables
load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Doc Chat Backend")

origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = auth.get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = auth.get_password_hash(user_in.password)
    user = models.User(email=user_in.email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, user_in.email, user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth.create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@app.post("/upload")
async def upload_documents(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()

    existing_document = db.query(models.Document).filter(
        models.Document.user_id == current_user.id,
        models.Document.filename == file.filename,
    ).first()
    if existing_document:
        existing_document.selected = True
        db.commit()
        db.refresh(existing_document)
        return {"detail": "Document already uploaded; it has been selected.", "document_id": existing_document.id}

    document = models.Document(
        user_id=current_user.id,
        filename=file.filename,
        selected=True,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        util.upload_pdf_to_storage(current_user.id, document.id, document.filename, file_bytes)
        util.add_document_to_vectorstore(current_user.id, document.id, document.filename, file_bytes)
    except Exception as exc:
        db.delete(document)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"detail": "Upload completed", "document_id": document.id}


@app.get("/documents", response_model=schemas.DocumentListResponse)
def list_documents(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    documents = (
        db.query(models.Document)
        .filter(models.Document.user_id == current_user.id)
        .order_by(models.Document.uploaded_at.desc())
        .all()
    )
    return {"documents": documents}


@app.patch("/documents/{document_id}", response_model=schemas.DocumentOut)
def update_document(
    document_id: int,
    document_in: schemas.DocumentSelectionUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.selected = document_in.selected
    db.commit()
    db.refresh(document)
    return document


@app.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(document)
    db.commit()
    util.delete_document_vectors(current_user.id, document_id)
    return {"detail": "Document deleted"}


@app.post("/chat", response_model=schemas.ChatResponse)
def chat_query(
    query: schemas.ChatQuery,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    user_documents = db.query(models.Document).filter(models.Document.user_id == current_user.id).all()
    user_document_ids = {document.id for document in user_documents}
    selected_document_ids = query.selected_document_ids or [
        document.id
        for document in user_documents
        if document.selected
    ]
    selected_document_ids = [
        document_id for document_id in selected_document_ids if document_id in user_document_ids
    ]
    if not selected_document_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one uploaded document before asking a question.",
        )

    try:
        result = util.query_user_vectorstore(
            current_user.id,
            query.question,
            query.model_name,
            selected_document_ids,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="Please upload PDF documents before asking questions.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if query.session_id:
        session = db.query(models.ChatSession).filter(
            models.ChatSession.id == query.session_id,
            models.ChatSession.user_id == current_user.id,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        session = models.ChatSession(
            user_id=current_user.id,
            title=query.question[:180] or "Untitled session",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    user_message = models.ChatMessage(
        session_id=session.id,
        role="user",
        content=query.question,
    )
    assistant_message = models.ChatMessage(
        session_id=session.id,
        role="assistant",
        content=result["answer"],
    )
    db.add_all([user_message, assistant_message])
    db.commit()

    return {
        "answer": result["answer"],
        "context": result["context"],
        "session_id": session.id,
    }


@app.get("/history", response_model=schemas.HistoryResponse)
def get_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(models.ChatSession)
        .options(joinedload(models.ChatSession.messages))
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.created_at.desc())
        .all()
    )

    return {"sessions": sessions}


@app.delete("/history/{session_id}")
def delete_history_session(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.delete(session)
    db.commit()
    return {"detail": "Chat session deleted"}
