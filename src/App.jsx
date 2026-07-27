
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import MoodFinderPage from './pages/MoodFinderPage'
import MoviePage from './pages/MoviePage'
import TagPage from './pages/TagPage'
import './App.css'



function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"            element={<LandingPage />} />
          <Route path="/movies"      element={<HomePage />} />
          <Route path="/auth"        element={<AuthPage />} />
          <Route path="/mood"        element={<MoodFinderPage />} />
          <Route path="/movie/:slug" element={<MoviePage />} />
          <Route path="/tag/:slug" element={<TagPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App


