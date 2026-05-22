import { FileText, Trash2 } from 'lucide-react'
import { DocumentMeta } from '../../types'

interface DocumentSelectionProps {
  documents: DocumentMeta[]
  onToggle: (documentId: number, selected: boolean) => void
  onRemove: (documentId: number) => void
  onClearSelection: () => void
}

const DocumentSelection = ({ documents, onToggle, onRemove, onClearSelection }: DocumentSelectionProps) => {
  const selectedCount = documents.filter((doc) => doc.selected).length

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-lg p-6 border border-gray-200 dark:border-gray-800 hover:shadow-lg dark:hover:shadow-xl transition-all duration-300">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Selected Documents</h3>
      </div>

      <div className="space-y-3">
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No documents uploaded yet
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between space-x-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gradient-to-r from-gray-50 to-gray-50 dark:from-gray-800 dark:to-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-50 dark:hover:from-gray-700 dark:hover:to-gray-700 transition-all duration-200"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  id={`doc-${doc.id}`}
                  checked={doc.selected}
                  onChange={() => onToggle(doc.id, !doc.selected)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor={`doc-${doc.id}`}
                  className={`text-sm cursor-pointer truncate ${doc.selected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                  title={doc.filename}
                >
                  {doc.filename}
                </label>
              </div>
              <button
                type="button"
                onClick={() => onRemove(doc.id)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                aria-label={`Remove ${doc.filename}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {selectedCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {selectedCount} document{selectedCount !== 1 ? 's' : ''} selected for queries
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  )
}

export default DocumentSelection
