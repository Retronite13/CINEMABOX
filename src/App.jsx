import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import MoodFinderPage from './pages/MoodFinderPage'
import MoviePage from './pages/MoviePage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/mood" element={<MoodFinderPage />} />
          {/* Each movie gets its own shareable URL */}
          <Route path="/movie/:slug" element={<MoviePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
