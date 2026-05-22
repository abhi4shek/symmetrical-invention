import type { FormEvent, RefObject } from 'react'
import { Loader, MessageSquare, FileText, Send, Trash2 } from 'lucide-react'
import { ChatMessage, DocumentMeta } from '../../types'

interface ChatPanelProps {
  selectedDocuments: DocumentMeta[]
  messages: ChatMessage[]
  currentMessage: string
  loading: boolean
  onMessageChange: (value: string) => void
  onSend: (e: FormEvent<HTMLFormElement>) => void
  onClear: () => void
  messagesEndRef: RefObject<HTMLDivElement>
}

const ChatPanel = ({
  selectedDocuments,
  messages,
  currentMessage,
  loading,
  onMessageChange,
  onSend,
  onClear,
  messagesEndRef,
}: ChatPanelProps) => (
  <div className="flex flex-col h-[600px]">
    {selectedDocuments.length > 0 && (
      <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Querying {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''}:
          </span>
          <div className="flex flex-wrap gap-1">
            {selectedDocuments.map((doc) => (
              <span key={doc.id} className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full">
                {doc.filename}
              </span>
            ))}
          </div>
        </div>
      </div>
    )}

    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Start a conversation</h3>
          <p className="text-gray-500 dark:text-gray-400">Upload a PDF document and ask questions about its content.</p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <div key={index} className="space-y-3">
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="bg-blue-600 dark:bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-xs lg:max-w-md shadow-sm">
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-bl-md px-4 py-3 max-w-xs lg:max-w-md shadow-sm whitespace-pre-wrap">
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            )}
            {msg.role === 'user' && index === messages.length - 1 && loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Loader className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Waiting for response...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>

    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onClear}
          className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <form onSubmit={onSend} className="flex-1 flex space-x-3">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Ask a question about your document..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !currentMessage.trim()}
            className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  </div>
)

export default ChatPanel
