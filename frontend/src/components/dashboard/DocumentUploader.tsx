import type { FormEvent, RefObject } from 'react'
import { Loader, Upload } from 'lucide-react'

interface DocumentUploaderProps {
  inputRef: RefObject<HTMLInputElement>
  selectedFile: File | null
  uploading: boolean
  onFileChange: (file: File | null) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

const DocumentUploader = ({ inputRef, selectedFile, uploading, onFileChange, onSubmit }: DocumentUploaderProps) => (
  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-lg p-6 border border-gray-200 dark:border-gray-800 hover:shadow-lg dark:hover:shadow-xl transition-all duration-300">
    <div className="flex items-center space-x-3 mb-6">
      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
        <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Document</h3>
    </div>
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select PDF File</label>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 transition-colors"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Selected: {selectedFile.name}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!selectedFile || uploading}
          className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {uploading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </>
          )}
        </button>
      </div>
    </form>
  </div>
)

export default DocumentUploader
