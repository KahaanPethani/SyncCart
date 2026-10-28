import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';
import socket from '../api/socket';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Connect socket and join household room if user is logged in
    if (user && user.householdId) {
      socket.connect();
      socket.emit('JOIN_HOUSEHOLD', user.householdId);
    }

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/login', { email, password });
      const userData = response.data;

      localStorage.setItem('token', userData.token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/register', { name, email, password });
      const userData = response.data;

      localStorage.setItem('token', userData.token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socket.disconnect();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}