import hashlib
import math
import os
import re
import warnings
from io import BytesIO
from typing import Any, Dict, List, Optional

import requests
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader


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


def vectorstore_dir(user_id: int) -> str:
    store_dir = os.path.join("data", "vectorstores", f"user_{user_id}")
    os.makedirs(store_dir, exist_ok=True)
    return store_dir


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
    metadatas = [{"document_id": document_id, "filename": filename} for _ in text_chunks]
    new_store = FAISS.from_texts(texts=text_chunks, embedding=embeddings, metadatas=metadatas)
    path = vectorstore_dir(user_id)
    index_file = os.path.join(path, "index.faiss")

    if os.path.exists(index_file):
        vector_store = FAISS.load_local(
            path,
            embeddings,
            allow_dangerous_deserialization=True,
        )
        vector_store.merge_from(new_store)
    else:
        vector_store = new_store

    vector_store.save_local(path)
    return path


def load_vectorstore(user_id: int) -> FAISS:
    path = vectorstore_dir(user_id)
    if not os.path.exists(os.path.join(path, "index.faiss")):
        raise FileNotFoundError("Vector store does not exist for this user.")
    embeddings = get_embedding_function()
    return FAISS.load_local(
        path,
        embeddings,
        allow_dangerous_deserialization=True,
    )


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
    vector_store = load_vectorstore(user_id)
    llm = build_llm(model_name)
    prompt = build_prompt()
    document_chain = create_stuff_documents_chain(llm, prompt)
    selected_ids = set(selected_document_ids or [])

    def metadata_filter(metadata: Dict[str, Any]) -> bool:
        return not selected_ids or metadata.get("document_id") in selected_ids

    documents = vector_store.similarity_search(
        question,
        k=5,
        filter=metadata_filter,
    )
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
