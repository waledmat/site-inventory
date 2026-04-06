import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axiosInstance';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = (tok, userData) => {
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setToken(tok);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  // Refresh token on startup to pick up any role changes since last login
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    api.get('/auth/me').then(r => {
      login(r.data.token, r.data.user);
    }).catch(() => {
      logout();
    });
  }, []);

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
