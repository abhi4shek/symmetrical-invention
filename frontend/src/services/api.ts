import { ChatSession, DocumentMeta } from '../types'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const parseResponse = async (response: Response) => {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || 'Request failed')
  }
  return data
}

export async function getDocuments() {
  const response = await fetch('/api/documents', {
    headers: getAuthHeaders(),
  })
  return parseResponse(response) as Promise<{ documents: DocumentMeta[] }>
}

export async function uploadDocument(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
  return parseResponse(response)
}

export async function updateDocumentSelection(documentId: number, selected: boolean) {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ selected }),
  })
  return parseResponse(response) as Promise<DocumentMeta>
}

export async function deleteDocument(documentId: number) {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  return parseResponse(response)
}

export async function getHistory() {
  const response = await fetch('/api/history', {
    headers: getAuthHeaders(),
  })
  return parseResponse(response) as Promise<{ sessions: ChatSession[] }>
}

export async function deleteHistory(sessionId: number) {
  const response = await fetch(`/api/history/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  return parseResponse(response)
}

export async function sendMessage(
  question: string,
  selectedDocumentIds: number[] = [],
  sessionId?: number,
  modelName = 'llama-3.1-8b-instant'
) {
  const body: Record<string, unknown> = {
    question,
    model_name: modelName,
  }

  if (sessionId) {
    body.session_id = sessionId
  }

  if (selectedDocumentIds.length > 0) {
    body.selected_document_ids = selectedDocumentIds
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  return parseResponse(response) as Promise<{ answer: string; context: object[]; session_id: number }>
}
