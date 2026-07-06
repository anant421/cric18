import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-2 px-4 py-3 sm:grid-cols-3">
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-navy">
          CDATA
        </Link>
        <Link to="/" className="hidden text-center text-sm font-bold tracking-wide text-navy sm:block">
          CData Premier League
        </Link>
        <div className="flex items-center justify-end gap-2">
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
