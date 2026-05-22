import { useState, useContext, useRef, useEffect, type FormEvent } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { ChatMessage, ChatSession, DocumentMeta } from '../types'
import {
  getDocuments,
  uploadDocument,
  updateDocumentSelection,
  deleteDocument,
  getHistory,
  deleteHistory,
  sendMessage,
} from '../services/api'
import DocumentUploader from './dashboard/DocumentUploader'
import DocumentSelection from './dashboard/DocumentSelection'
import ChatPanel from './dashboard/ChatPanel'
import HistoryPanel from './dashboard/HistoryPanel'
import {
  FileText,
  User,
  LogOut,
  Moon,
  Sun,
  MessageSquare,
  History,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

const Dashboard = () => {
  const { user, setUser } = useContext(AuthContext)
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [expandedSessions, setExpandedSessions] = useState<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedDocuments = documents.filter((doc) => doc.selected)

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showSuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(''), 3000)
  }

  const showError = (message: string) => {
    setError(message)
    setTimeout(() => setError(''), 5000)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setDocuments([])
    setMessages([])
    setChatHistory([])
  }

  const loadDocuments = async () => {
    try {
      const data = await getDocuments()
      setDocuments(data.documents || [])
    } catch {
      showError('Failed to load documents')
    }
  }

  const handleFileUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFile) return

    setUploading(true)
    setError('')

    try {
      await uploadDocument(selectedFile)
      await loadDocuments()
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      showSuccess('Document uploaded successfully!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentMessage.trim()) return

    const userMessage = currentMessage.trim()
    setCurrentMessage('')
    setLoading(true)
    setError('')

    const tempMessage: ChatMessage = {
      user_id: user!.id,
      session_id: 1,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMessage])

    try {
      const response = await sendMessage(
        userMessage,
        selectedDocuments.map((doc) => doc.id)
      )

      const assistantMessage: ChatMessage = {
        user_id: user!.id,
        session_id: 1,
        role: 'assistant',
        content: response.answer,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send message')
      setMessages((prev) => prev.filter((msg) => !(msg.role === 'user' && msg.content === userMessage)))
    } finally {
      setLoading(false)
    }
  }

  const loadChatHistory = async () => {
    setHistoryLoading(true)
    try {
      const data = await getHistory()
      setChatHistory(data.sessions || [])
    } catch {
      showError('Failed to load chat history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const deleteHistorySession = async (sessionId: number) => {
    try {
      await deleteHistory(sessionId)
      setChatHistory((prev) => prev.filter((session) => session.id !== sessionId))
      showSuccess('History session deleted')
    } catch {
      showError('Failed to delete history session')
    }
  }

  const clearChat = () => {
    setMessages([])
    showSuccess('Chat cleared')
  }

  const handleDocumentToggle = async (documentId: number, selected: boolean) => {
    try {
      const updated = await updateDocumentSelection(documentId, selected)
      setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? updated : doc)))
    } catch {
      showError('Failed to update document selection')
    }
  }

  const removeUploadedDocument = async (documentId: number) => {
    try {
      await deleteDocument(documentId)
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
      showSuccess('Document removed')
    } catch {
      showError('Failed to remove document')
    }
  }

  const clearSelection = async () => {
    const selected = documents.filter((doc) => doc.selected)
    try {
      await Promise.all(selected.map((doc) => updateDocumentSelection(doc.id, false)))
      setDocuments((prev) => prev.map((doc) => ({ ...doc, selected: false })))
    } catch {
      showError('Failed to clear selection')
    }
  }

  const toggleSessionExpansion = (sessionId: number) => {
    setExpandedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    )
  }

  const handleTabChange = (tab: 'chat' | 'history') => {
    setActiveTab(tab)
    if (tab === 'history' && chatHistory.length === 0) {
      loadChatHistory()
    }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm dark:shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">Doc Chat</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">AI-Powered PDF Assistant</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{user?.email?.split('@')[0] || 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:shadow-md"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {(success || error) && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          {success && (
            <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">{success}</p>
            </div>
          )}
          {error && (
            <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <DocumentUploader
              inputRef={fileInputRef}
              selectedFile={selectedFile}
              uploading={uploading}
              onFileChange={setSelectedFile}
              onSubmit={handleFileUpload}
            />
            <DocumentSelection
              documents={documents}
              onToggle={handleDocumentToggle}
              onRemove={removeUploadedDocument}
              onClearSelection={clearSelection}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <nav className="flex">
                  <button
                    onClick={() => handleTabChange('chat')}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'chat'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Chat
                  </button>
                  <button
                    onClick={() => handleTabChange('history')}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'history'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <History className="w-5 h-5 mr-2" />
                    History
                  </button>
                </nav>
              </div>

              {activeTab === 'chat' ? (
                <ChatPanel
                  selectedDocuments={selectedDocuments}
                  messages={messages}
                  currentMessage={currentMessage}
                  loading={loading}
                  onMessageChange={setCurrentMessage}
                  onSend={handleSendMessage}
                  onClear={clearChat}
                  messagesEndRef={messagesEndRef}
                />
              ) : (
                <HistoryPanel
                  chatHistory={chatHistory}
                  expandedSessions={expandedSessions}
                  historyLoading={historyLoading}
                  onToggleSession={toggleSessionExpansion}
                  onRefresh={loadChatHistory}
                  onDeleteSession={deleteHistorySession}
                  formatDate={formatDate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
