import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../services/api'; 
import Button from '../components/ui/Button';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/profile');
        // Check if response is empty or missing key goal data
        if (!response || Object.keys(response).length === 0 || !response.calories) {
          setProfile({});
          setShowWelcomeModal(true);
        } else {
          setProfile(response);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setShowWelcomeModal(true); // Treat errors as "needs setup"
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const totals = (profile?.meal_plan || []).reduce((acc, item) => {
    const qty = item.quantity || 0;
    return {
      calories: acc.calories + (item.calories_per_serving * qty),
      protein: acc.protein + (item.protein_per_serving * qty),
      carbs: acc.carbs + (item.carbs_per_serving * qty),
      fat: acc.fat + (item.fat_per_serving * qty),
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Helper to calculate percentage for progress bars
  const getPercentage = (actual, goal) => {
    if (!goal || goal === 0) return 0;
    const pct = (actual / goal) * 100;
    return Math.min(pct, 100); // Cap at 100% for the UI
  };

  if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;

  return (
    
<div className="relative space-y-6">
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-200 dark:border-gray-700">
            <div className="mb-4 text-5xl">🧬</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Gemini Health!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We're excited to help you reach your goals. To get started, we need to calculate your personalized macro targets based on your genetic profile.
            </p>
            <button
              onClick={() => navigate('/macro-goals')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg shadow-blue-500/30"
            >
              Set My Macro Goals
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Logged in as <span className="font-semibold text-blue-600">{user?.username}</span>
        </p>
      </div>

      {/* Unified Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Calories Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Calories</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(totals.calories)}</span>
            <span className="text-gray-400 text-sm">/ {profile?.calories || 0} kcal</span>
          </div>
          <div className="mt-4 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500" 
              style={{ width: `${getPercentage(totals.calories, profile?.calories)}%` }}
            />
          </div>
        </div>

        {/* Protein Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Protein</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{Math.round(totals.protein)}g</span>
            <span className="text-gray-400 text-sm">/ {profile?.protein || 0}g</span>
          </div>
          <div className="mt-4 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-600 transition-all duration-500" 
              style={{ width: `${getPercentage(totals.protein, profile?.protein)}%` }}
            />
          </div>
        </div>

        {/* Carbs Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Carbs</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{Math.round(totals.carbs)}g</span>
            <span className="text-gray-400 text-sm">/ {profile?.carbs || 0}g</span>
          </div>
          <div className="mt-4 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-600 transition-all duration-500" 
              style={{ width: `${getPercentage(totals.carbs, profile?.carbs)}%` }}
            />
          </div>
        </div>

        {/* Fat Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Fat</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">{Math.round(totals.fat)}g</span>
            <span className="text-gray-400 text-sm">/ {profile?.fat || 0}g</span>
          </div>
          <div className="mt-4 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-600 transition-all duration-500" 
              style={{ width: `${getPercentage(totals.fat, profile?.fat)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button onClick={() => navigate('/macro-goals')} className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Edit Goals</p>
            </button>
            <button onClick={() => navigate('/meal-planner')} className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Log Meals</p>
            </button>
          </div>
        </div>
        
        {/* We can use this space for a "Recent Foods" list or "Genetic Insights" */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Daily Summary</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totals.calories > profile?.calories 
              ? "You've exceeded your calorie goal for today." 
              : `You have ${Math.round((profile?.calories || 0) - totals.calories)} kcal remaining.`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;