import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import TournamentPage from './pages/TournamentPage.jsx';
import MatchLive from './pages/MatchLive.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminTournamentSetup from './pages/AdminTournamentSetup.jsx';
import AdminScoring from './pages/AdminScoring.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournaments/:id" element={<TournamentPage />} />
        <Route path="/matches/:id" element={<MatchLive />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tournaments/:id"
          element={
            <ProtectedRoute>
              <AdminTournamentSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/matches/:id/score"
          element={
            <ProtectedRoute>
              <AdminScoring />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
