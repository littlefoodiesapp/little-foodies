import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ExplorePage   from './pages/ExplorePage'
import RestaurantPage from './pages/RestaurantPage'
import ProfilePage   from './pages/ProfilePage'
import LoginPage     from './pages/LoginPage'

export default function App() {
  const { isLoggedIn, loading } = useAuth()
  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>

  return (
    <Routes>
      <Route path="/"           element={<ExplorePage />} />
      <Route path="/restaurant/:id" element={<RestaurantPage />} />
      <Route path="/profile"    element={isLoggedIn ? <ProfilePage /> : <Navigate to="/login" />} />
      <Route path="/login"      element={!isLoggedIn ? <LoginPage /> : <Navigate to="/" />} />
    </Routes>
  )
}
