import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const MacroGoals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });
  const [currentGoals, setCurrentGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Preset macro goals
  const presets = [
    { name: 'Balanced', calories: 2000, protein: 150, carbs: 250, fat: 67 },
    { name: 'High Protein', calories: 2000, protein: 200, carbs: 150, fat: 67 },
    { name: 'Low Carb', calories: 2000, protein: 150, carbs: 100, fat: 89 },
    { name: 'Keto', calories: 2000, protein: 150, carbs: 25, fat: 156 },
    { name: 'Weight Loss', calories: 1500, protein: 120, carbs: 188, fat: 50 },
    { name: 'Bulking', calories: 3000, protein: 225, carbs: 375, fat: 100 }
  ];

  useEffect(() => {
    fetchCurrentGoals();
  }, []);

  const fetchCurrentGoals = async () => {
    try {
      const response = await api.get('/macro-goals');
      if (response.data) {
        setCurrentGoals(response.data);
        setGoals({
          calories: response.data.calories || '',
          protein: response.data.protein || '',
          carbs: response.data.carbs || '',
          fat: response.data.fat || ''
        });
      }
    } catch (error) {
      console.error('Error fetching macro goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setGoals(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePresetSelect = (preset) => {
    setGoals({
      calories: preset.calories,
      protein: preset.protein,
      carbs: preset.carbs,
      fat: preset.fat
    });
    setMessage(`Loaded ${preset.name} preset`);
    setTimeout(() => setMessage(''), 3000);
  };

  const calculateCaloriesFromMacros = () => {
    const protein = parseFloat(goals.protein) || 0;
    const carbs = parseFloat(goals.carbs) || 0;
    const fat = parseFloat(goals.fat) || 0;
    return Math.round(protein * 4 + carbs * 4 + fat * 9);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await api.post('/macro-goals', {
        calories: parseInt(goals.calories),
        protein: parseFloat(goals.protein),
        carbs: parseFloat(goals.carbs),
        fat: parseFloat(goals.fat)
      });

      setCurrentGoals(response.data.goals);
      setMessage('Macro goals saved successfully!');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save macro goals');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Macro Goals
      </h1>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.includes('success') 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Goals */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Current Goals
          </h2>
          {currentGoals ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Calories:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentGoals.calories} kcal
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Protein:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentGoals.protein}g ({Math.round((currentGoals.protein * 4 / currentGoals.calories) * 100)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Carbs:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentGoals.carbs}g ({Math.round((currentGoals.carbs * 4 / currentGoals.calories) * 100)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Fat:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentGoals.fat}g ({Math.round((currentGoals.fat * 9 / currentGoals.calories) * 100)}%)
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              No macro goals set yet
            </p>
          )}
        </div>

        {/* Set New Goals */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Set New Goals
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Calories (kcal)
              </label>
              <input
                type="number"
                name="calories"
                value={goals.calories}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                step="0.1"
                name="protein"
                value={goals.protein}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Carbs (g)
              </label>
              <input
                type="number"
                step="0.1"
                name="carbs"
                value={goals.carbs}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fat (g)
              </label>
              <input
                type="number"
                step="0.1"
                name="fat"
                value={goals.fat}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {goals.protein && goals.carbs && goals.fat && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Calculated calories: {calculateCaloriesFromMacros()} kcal
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md 
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200"
            >
              {saving ? 'Saving...' : 'Save Goals'}
            </button>
          </form>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Quick Presets
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset)}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg
                       hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200
                       text-left"
            >
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                {preset.name}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>{preset.calories} kcal</div>
                <div>P: {preset.protein}g | C: {preset.carbs}g | F: {preset.fat}g</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MacroGoals;