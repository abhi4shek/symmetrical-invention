from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserLogin(UserCreate):
    pass


class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ChatMessageCreate(BaseModel):
    role: str
    content: str


class ChatMessageOut(ChatMessageCreate):
    created_at: datetime

    class Config:
        orm_mode = True


class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    messages: List[ChatMessageOut] = Field(default_factory=list)

    class Config:
        orm_mode = True


class ChatQuery(BaseModel):
    question: str = Field(min_length=1)
    session_id: Optional[int] = None
    model_name: Optional[str] = None
    selected_document_ids: List[int] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    context: List[Dict[str, str]]
    session_id: int


class DocumentSelectionUpdate(BaseModel):
    selected: bool


class DocumentOut(BaseModel):
    id: int
    filename: str
    selected: bool
    uploaded_at: datetime

    class Config:
        orm_mode = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentOut]


class HistoryResponse(BaseModel):
    sessions: List[ChatSessionOut]
