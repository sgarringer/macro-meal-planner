import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const MacroGoals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    track_net_carbs: false
  });
  const [currentGoals, setCurrentGoals] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Preset macro goals
  const presets = [
    { name: 'Balanced', calories: 2000, protein: 150, carbs: 250, fat: 67, fiber: 30, track_net_carbs: false },
    { name: 'High Protein', calories: 2000, protein: 200, carbs: 150, fat: 67, fiber: 25, track_net_carbs: false },
    { name: 'Low Carb', calories: 2000, protein: 150, carbs: 100, fat: 89, fiber: 20, track_net_carbs: true },
    { name: 'Keto', calories: 2000, protein: 150, carbs: 25, fat: 156, fiber: 15, track_net_carbs: true },
    { name: 'Weight Loss', calories: 1500, protein: 120, carbs: 188, fat: 50, fiber: 28, track_net_carbs: false },
    { name: 'Bulking', calories: 3000, protein: 225, carbs: 375, fat: 100, fiber: 40, track_net_carbs: false }
  ];

  useEffect(() => {
    fetchCurrentGoals();
  }, []);

  const fetchCurrentGoals = async () => {
    try {
      const response = await api.get('/macro-goals');
      if (response && response.id) {
        setCurrentGoals(response);
        setGoals({
          calories: response.calories || '',
          protein: response.protein || '',
          carbs: response.carbs || '',
          fat: response.fat || '',
          fiber: response.fiber || '',
          track_net_carbs: response.track_net_carbs || false
        });
        
        // Check if current goals match any preset
        const matchingPreset = presets.find(preset => 
          preset.calories === response.calories &&
          preset.protein === response.protein &&
          preset.carbs === response.carbs &&
          preset.fat === response.fat &&
          preset.fiber === response.fiber &&
          preset.track_net_carbs === Boolean(response.track_net_carbs)
        );
        
        // Set selectedPreset based on whether we found a match
        setSelectedPreset(matchingPreset ? matchingPreset.name : 'custom');
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

  const handlePresetSelect = (presetName) => {
    setSelectedPreset(presetName);
    if (presetName !== 'custom') {
      const preset = presets.find(p => p.name === presetName);
      if (preset) {
        setGoals({
          calories: preset.calories,
          protein: preset.protein,
          carbs: preset.carbs,
          fat: preset.fat,
          fiber: preset.fiber,
          track_net_carbs: preset.track_net_carbs
        });
      }
    }
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
        fat: parseFloat(goals.fat),
        fiber: parseFloat(goals.fiber),
        track_net_carbs: goals.track_net_carbs ? 1 : 0
      });

      setCurrentGoals(response.goals);
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
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Fiber:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentGoals.fiber}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Carb Tracking:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentGoals.track_net_carbs ? 'Net Carbs' : 'Total Carbs'}
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
            {/* Preset Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Preset or Custom
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="custom">Custom</option>
                {presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} ({preset.calories} cal, P:{preset.protein}g C:{preset.carbs}g F:{preset.fat}g Fiber:{preset.fiber}g)
                  </option>
                ))}
              </select>
            </div>

            {/* Show input fields only for custom */}
            {selectedPreset === 'custom' && (
              <>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fiber (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="fiber"
                    value={goals.fiber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="track_net_carbs"
                    checked={goals.track_net_carbs}
                    onChange={(e) => setGoals(prev => ({ ...prev, track_net_carbs: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="track_net_carbs" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Track Net Carbs (Carbs - Fiber)
                  </label>
                </div>

                {goals.protein && goals.carbs && goals.fat && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Calculated calories: {calculateCaloriesFromMacros()} kcal
                  </div>
                )}
              </>
            )}

            {/* Show preset summary for non-custom selections */}
            {selectedPreset !== 'custom' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {selectedPreset} Preset
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <div>Calories: {goals.calories} kcal</div>
                  <div>Protein: {goals.protein}g ({Math.round((goals.protein * 4 / goals.calories) * 100)}%)</div>
                  <div>Carbs: {goals.carbs}g ({Math.round((goals.carbs * 4 / goals.calories) * 100)}%)</div>
                  <div>Fat: {goals.fat}g ({Math.round((goals.fat * 9 / goals.calories) * 100)}%)</div>
                </div>
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

      {/* Diet Styles Information */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Diet Styles & Approaches
        </h2>
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Different dietary approaches can help you achieve specific health and fitness goals. 
            Understanding these styles can help you choose the right macro balance for your needs.
          </p>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Balanced Diet</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A well-rounded approach with moderate amounts of all macronutrients. Typically 40-50% carbs, 
                25-35% protein, and 20-30% fat. Suitable for general health and maintenance.
              </p>
            </div>
            
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">High Protein</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Emphasizes protein intake (35-40% of calories) to support muscle growth and recovery. 
                Popular for strength training and body recomposition goals.
              </p>
            </div>
            
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Low Carb</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Reduces carbohydrate intake (typically under 100g/day) while increasing fats. 
                May help with appetite control and stable energy levels.
              </p>
            </div>
            
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Ketogenic (Keto)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Very low carb (under 50g/day), high fat approach that promotes ketosis. 
                Approximately 70-75% fat, 20-25% protein, 5-10% carbs.
              </p>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-6 italic">
            Note: Always consult with a healthcare professional or registered dietitian before making 
            significant changes to your diet, especially if you have any health conditions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MacroGoals;