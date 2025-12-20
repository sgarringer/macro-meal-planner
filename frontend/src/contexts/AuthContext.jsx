import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('authToken'),
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
    case 'LOAD_USER_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'LOGIN_FAILURE':
    case 'LOAD_USER_FAILURE':
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload || null,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        dispatch({ type: 'LOAD_USER_FAILURE', payload: 'No token found' });
        return;
      }

      try {
        const response = await authAPI.getMe();
        dispatch({
          type: 'LOAD_USER_SUCCESS',
          payload: { user: response.user, token },
        });
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        dispatch({
          type: 'LOAD_USER_FAILURE',
          payload: error.error || 'Failed to load user',
        });
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response,
      });
      
      return response;
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error.error || 'Login failed',
      });
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response,
      });
      
      return response;
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error.error || 'Registration failed',
      });
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;