import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import MoodFinderPage from './pages/MoodFinderPage'
import './App.css'

function App() {
  return (
    // AuthProvider wraps everything so any page/component below can call useAuth()
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/mood" element={<MoodFinderPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
