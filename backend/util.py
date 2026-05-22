import hashlib
import math
import os
import re
import uuid
import warnings
from io import BytesIO
from typing import Any, Dict, List, Optional

import requests
from langchain.docstore.document import Document as LangchainDocument
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from langchain_groq import ChatGroq
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

VECTOR_SIZE = 384
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "doc_chat_chunks")


class LocalHashEmbeddings(Embeddings):
    def __init__(self, size: int = 384):
        self.size = size

    def _embed(self, text: str) -> List[float]:
        vector = [0.0] * self.size
        words = re.findall(r"\w+", text.lower())
        for word in words:
            digest = hashlib.sha256(word.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.size
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm:
            vector = [value / norm for value in vector]
        return vector

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)


class CheckedHuggingFaceEmbeddings(HuggingFaceInferenceAPIEmbeddings):
    @property
    def _api_url(self) -> str:
        return (
            "https://router.huggingface.co/hf-inference/models/"
            f"{self.model_name}/pipeline/feature-extraction"
        )

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        response = requests.post(
            self._api_url,
            headers=self._headers,
            json={
                "inputs": texts,
                "options": {"wait_for_model": True, "use_cache": True},
            },
            timeout=120,
        )

        if not response.content:
            raise ValueError(
                "Hugging Face returned an empty response while creating embeddings. "
                "Check INFERENCE_API_KEY and try again."
            )

        try:
            data = response.json()
        except ValueError as exc:
            detail = response.text[:300].strip()
            raise ValueError(
                "Hugging Face returned a non-JSON response while creating embeddings "
                f"(HTTP {response.status_code}). {detail}"
            ) from exc

        if response.status_code >= 400:
            message = data.get("error", data) if isinstance(data, dict) else data
            if response.status_code in (401, 403):
                raise ValueError(
                    "Hugging Face rejected the embedding request. Create or update "
                    "INFERENCE_API_KEY as a fine-grained Hugging Face token with "
                    "'Make calls to Inference Providers' permission enabled. "
                    f"Details: {message}"
                )
            raise ValueError(
                f"Hugging Face embedding request failed (HTTP {response.status_code}): {message}"
            )

        if isinstance(data, dict) and "error" in data:
            raise ValueError(f"Hugging Face embedding request failed: {data['error']}")

        return data


class FallbackEmbeddings(Embeddings):
    def __init__(self, primary: Embeddings, fallback: Embeddings):
        self.primary = primary
        self.fallback = fallback

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        try:
            return self.primary.embed_documents(texts)
        except ValueError as exc:
            warnings.warn(f"{exc} Using local embeddings for this session instead.")
            return self.fallback.embed_documents(texts)

    def embed_query(self, text: str) -> List[float]:
        try:
            return self.primary.embed_query(text)
        except ValueError:
            return self.fallback.embed_query(text)


def get_env_variable(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def read_pdf_data(file_bytes: bytes) -> str:
    text = ""
    stream = BytesIO(file_bytes)
    pdf_reader = PdfReader(stream)
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text


def split_data(text: str) -> List[str]:
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    return text_splitter.split_text(text)


def get_embedding_function() -> Embeddings:
    inference_api_key = get_env_variable("INFERENCE_API_KEY")
    if not inference_api_key:
        warnings.warn("INFERENCE_API_KEY is missing. Using local embeddings instead.")
        return LocalHashEmbeddings()

    hugging_face_embeddings = CheckedHuggingFaceEmbeddings(
        api_key=inference_api_key,
        model_name="sentence-transformers/all-MiniLM-L6-v2",
    )
    return FallbackEmbeddings(hugging_face_embeddings, LocalHashEmbeddings())


def get_qdrant_client() -> QdrantClient:
    qdrant_url = get_env_variable("QDRANT_URL")
    qdrant_api_key = get_env_variable("QDRANT_API_KEY")
    if not qdrant_url:
        raise ValueError("QDRANT_URL is required for online vector storage.")
    return QdrantClient(url=qdrant_url, api_key=qdrant_api_key or None)


def ensure_qdrant_collection(client: QdrantClient) -> None:
    try:
        client.get_collection(QDRANT_COLLECTION)
    except Exception:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=qdrant_models.VectorParams(
                size=VECTOR_SIZE,
                distance=qdrant_models.Distance.COSINE,
            ),
        )


def storage_object_path(user_id: int, document_id: int, filename: str) -> str:
    clean_filename = re.sub(r"[^A-Za-z0-9_.-]+", "_", filename).strip("._")
    return f"user_{user_id}/document_{document_id}/{clean_filename or 'document.pdf'}"


def upload_pdf_to_storage(
    user_id: int,
    document_id: int,
    filename: str,
    file_bytes: bytes,
) -> Optional[str]:
    supabase_url = get_env_variable("SUPABASE_URL")
    service_key = get_env_variable("SUPABASE_SERVICE_ROLE_KEY")
    bucket = get_env_variable("SUPABASE_BUCKET", "documents")
    if not supabase_url or not service_key:
        warnings.warn("Supabase Storage is not configured. Skipping PDF backup upload.")
        return None

    object_path = storage_object_path(user_id, document_id, filename)
    upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    response = requests.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
        data=file_bytes,
        timeout=120,
    )
    if response.status_code >= 400:
        raise ValueError(f"Supabase Storage upload failed: {response.text[:300]}")
    return object_path


def add_document_to_vectorstore(
    user_id: int,
    document_id: int,
    filename: str,
    file_bytes: bytes,
) -> str:
    raw_text = read_pdf_data(file_bytes)
    if not raw_text.strip():
        raise ValueError("No readable text was found in the uploaded PDF.")

    text_chunks = split_data(raw_text)
    if not text_chunks:
        raise ValueError("No text chunks could be created from the uploaded PDF.")

    embeddings = get_embedding_function()
    vectors = embeddings.embed_documents(text_chunks)
    client = get_qdrant_client()
    ensure_qdrant_collection(client)

    points = []
    for index, (chunk, vector) in enumerate(zip(text_chunks, vectors)):
        points.append(
            qdrant_models.PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload={
                    "user_id": user_id,
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_index": index,
                    "text": chunk,
                },
            )
        )

    client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return QDRANT_COLLECTION


def document_filter(user_id: int, selected_document_ids: List[int]) -> qdrant_models.Filter:
    return qdrant_models.Filter(
        must=[
            qdrant_models.FieldCondition(
                key="user_id",
                match=qdrant_models.MatchValue(value=user_id),
            ),
            qdrant_models.FieldCondition(
                key="document_id",
                match=qdrant_models.MatchAny(any=selected_document_ids),
            ),
        ]
    )


def delete_document_vectors(user_id: int, document_id: int) -> None:
    try:
        client = get_qdrant_client()
        ensure_qdrant_collection(client)
        client.delete(
            collection_name=QDRANT_COLLECTION,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="user_id",
                            match=qdrant_models.MatchValue(value=user_id),
                        ),
                        qdrant_models.FieldCondition(
                            key="document_id",
                            match=qdrant_models.MatchValue(value=document_id),
                        ),
                    ]
                )
            ),
        )
    except Exception as exc:
        warnings.warn(f"Could not delete vectors for document {document_id}: {exc}")


def build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_template(
        """Answer the question using only the context below.
        If the answer is not in the context, say that the uploaded documents do not contain enough information.

        <context>
        {context}

        Question: {input}
        """
    )


def build_llm(model_name: Optional[str] = None) -> ChatGroq:
    groq_api_key = get_env_variable("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY is required for chat inference.")
    return ChatGroq(
        groq_api_key=groq_api_key,
        model_name=model_name or get_env_variable("DEFAULT_GROQ_MODEL", "llama-3.1-8b-instant"),
    )


def query_user_vectorstore(
    user_id: int,
    question: str,
    model_name: Optional[str] = None,
    selected_document_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    selected_ids = selected_document_ids or []
    if not selected_ids:
        raise ValueError("At least one document must be selected before querying.")

    embeddings = get_embedding_function()
    query_vector = embeddings.embed_query(question)
    client = get_qdrant_client()
    ensure_qdrant_collection(client)
    llm = build_llm(model_name)
    prompt = build_prompt()
    document_chain = create_stuff_documents_chain(llm, prompt)

    hits = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=query_vector,
        query_filter=document_filter(user_id, selected_ids),
        limit=5,
    )
    documents = [
        LangchainDocument(
            page_content=str(hit.payload.get("text", "")),
            metadata={
                "filename": hit.payload.get("filename", ""),
                "document_id": hit.payload.get("document_id"),
            },
        )
        for hit in hits
        if hit.payload and hit.payload.get("text")
    ]
    if not documents:
        return {
            "answer": "No matching content was found in the selected documents.",
            "context": [],
        }

    result = document_chain.invoke({"input": question, "context": documents})

    if isinstance(result, dict):
        answer = result.get("answer") or str(result)
    else:
        answer = str(result)
    context = []
    for doc in documents:
        page_content = getattr(doc, "page_content", str(doc))
        metadata = getattr(doc, "metadata", {})
        context.append({"page_content": page_content, "filename": metadata.get("filename", "")})

    return {"answer": answer, "context": context}
