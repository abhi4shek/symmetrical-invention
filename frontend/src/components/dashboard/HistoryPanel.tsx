import { Loader, MessageSquare, Clock, ChevronDown, ChevronRight, RefreshCw, History, Trash2 } from 'lucide-react'
import { ChatSession } from '../../types'

interface HistoryPanelProps {
  chatHistory: ChatSession[]
  expandedSessions: number[]
  historyLoading: boolean
  onToggleSession: (sessionId: number) => void
  onRefresh: () => void
  onDeleteSession: (sessionId: number) => void
  formatDate: (dateString: string) => string
}

const HistoryPanel = ({
  chatHistory,
  expandedSessions,
  historyLoading,
  onToggleSession,
  onRefresh,
  onDeleteSession,
  formatDate,
}: HistoryPanelProps) => (
  <div className="p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chat History</h3>
      <button
        type="button"
        onClick={onRefresh}
        disabled={historyLoading}
        className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>

    <div className="space-y-4">
      {historyLoading ? (
        <div className="text-center py-12">
          <Loader className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading history...</p>
        </div>
      ) : chatHistory.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No chat history yet</h3>
          <p className="text-gray-500 dark:text-gray-400">Your conversations will appear here.</p>
        </div>
      ) : (
        chatHistory.map((session) => {
          const expanded = expandedSessions.includes(session.id)
          return (
            <div key={session.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-colors">
              <div
                role="button"
                onClick={() => onToggleSession(session.id)}
                className="w-full flex items-center justify-between px-6 py-5 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Session {session.id}</h4>
                    <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(session.created_at)}</span>
                      <span>•</span>
                      <span>{session.messages.length} message{session.messages.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                    className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>
              {expanded && (
                <div className="space-y-3 p-6 bg-white dark:bg-gray-800">
                  {session.messages.map((msg, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                      <div className="flex items-start space-x-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          msg.role === 'user'
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
                            : 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
                        }`}>
                          {msg.role === 'user' ? 'Q:' : 'A:'}
                        </span>
                        <p className="text-sm text-gray-900 dark:text-white flex-1 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  </div>
)

export default HistoryPanel
