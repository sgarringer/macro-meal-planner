import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios'; // Or use your authAPI if updated
import api from '../services/api'; // Import YOUR configured axios instance

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_USER_SUCCESS':
      return { ...state, user: action.payload, isAuthenticated: true, isLoading: false, error: null };
    case 'LOAD_USER_FAILURE':
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false, isLoading: false, error: action.payload || null };
    default:
      return state;
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check session on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await api.get('/auth/me'); // Uses baseURL and withCredentials
        dispatch({ type: 'LOAD_USER_SUCCESS', payload: response.user });
      } catch (error) {
        dispatch({ type: 'LOAD_USER_FAILURE' });
      }
    };
    loadUser();
  }, []);

  // Login now just triggers a redirect to the backend
  const login = () => {
    process.env.BACKEND_URL
    window.location.href = `${process.env.BACKEND_URL}/login?returnTo=${process.env.FRONTEND_URL}/dashboard`;
  };

  // Logout triggers the backend logout flow
  const logout = () => {
    window.location.href = `${process.env.BACKEND_URL}/logout?returnTo=${process.env.FRONTEND_URL}/`;
    dispatch({ type: 'LOGOUT' });
  };

  const value = { ...state, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
