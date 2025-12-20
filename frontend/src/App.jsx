import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import Layout from './layouts/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MacroGoals from './pages/MacroGoals';
import Meals from './pages/Meals';
import Foods from './pages/Foods';
import MealPlanner from './pages/MealPlanner';
import LinkedFoods from './pages/LinkedFoods';
import AIConfig from './pages/AIConfig';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  return token ? children : <Navigate to="/login" replace />;
};

// Public route component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  return token ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/register" element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } />
              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="macro-goals" element={<MacroGoals />} />
                <Route path="meals" element={<Meals />} />
                <Route path="foods" element={<Foods />} />
                <Route path="meal-planner" element={<MealPlanner />} />
                <Route path="linked-foods" element={<LinkedFoods />} />
                <Route path="ai-config" element={<AIConfig />} />
              </Route>
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;