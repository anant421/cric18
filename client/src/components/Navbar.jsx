import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const ghostBtn =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95';

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-2 px-4 py-3 sm:grid-cols-3">
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-brand">
          CDATA
        </Link>
        <Link to="/" className="hidden text-center text-sm font-bold tracking-wide text-brand sm:block">
          CData Premier League
        </Link>
        <div className="flex items-center justify-end gap-2">
          {isAdmin ? (
            <>
              <Link to="/admin" className={ghostBtn}>
                Admin
              </Link>
              <button
                className={ghostBtn}
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/admin/login" className="btn-primary rounded-full">
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
