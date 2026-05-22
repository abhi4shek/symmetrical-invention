import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import { AuthContext } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { apiUrl } from './config'
import type { User } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('token')
    if (token) {
      // Verify token with backend
      fetch(apiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setUser(data)
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
      })
      .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ user, setUser }}>
        <div id="app-root" className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 transition-colors duration-300">
          <Routes>
            <Route
              path="/auth"
              element={user ? <Navigate to="/" /> : <Auth />}
            />
            <Route
              path="/"
              element={user ? <Dashboard /> : <Navigate to="/auth" />}
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </AuthContext.Provider>
    </ThemeProvider>
  )
}

export default App
