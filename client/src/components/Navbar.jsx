import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="leading-tight">
          <span className="block text-2xl font-extrabold tracking-tight text-navy">CDATA</span>
          <span className="block text-[11px] font-medium tracking-wide text-slate-500">ScoreXI · Live Cricket Scoring</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Link to="/admin" className="btn-secondary">
                Admin
              </Link>
              <button
                className="btn-secondary"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/admin/login" className="btn-primary">
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
