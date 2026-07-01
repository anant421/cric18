import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-accent font-display text-lg tracking-wide text-white shadow-sm">
            XI
          </span>
          <span className="leading-tight">
            <span className="block font-display text-2xl leading-none tracking-wide text-navy">SCORE XI</span>
            <span className="block text-[11px] font-medium text-slate-400">Live Cricket Scoring</span>
          </span>
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
