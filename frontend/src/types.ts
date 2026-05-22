export interface User {
  id: number
  email: string
  created_at: string
}

export interface ChatMessage {
  id?: number
  user_id?: number
  session_id?: number
  role: string
  content: string
  created_at?: string
}

export interface ChatSession {
  id: number
  user_id?: number
  title?: string
  created_at: string
  messages: ChatMessage[]
}

export interface DocumentMeta {
  id: number
  filename: string
  selected: boolean
  uploaded_at: string
}

export interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
}
