import React, { useState } from 'react';
import { aiAPI } from '../services/api';
import api from '../services/api';

const AISuggestions = ({ 
  selectedMeal, 
  currentDate, 
  onAddFood, 
  onRefresh 
}) => {
  const [show, setShow] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState('daily');
  const [preferences, setPreferences] = useState('');
  const [message, setMessage] = useState('');
  const [addingFood, setAddingFood] = useState(null);

  const handleGetSuggestions = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await aiAPI.getSuggestion(scope, preferences);
      setSuggestions(response.suggestions || []);
      setShow(true);
      setMessage(`Got ${response.suggestions?.length || 0} AI suggestions from ${response.provider}`);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      setMessage('Failed to get AI suggestions. Please check your AI configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion) => {
    if (!selectedMeal) {
      setMessage('Please select a meal first to add the AI suggestion');
      return;
    }

    setAddingFood(suggestion.name);
    
    try {
      // First, check if the food already exists in the user's inventory
      const foodsResponse = await api.get(`/foods?search=${encodeURIComponent(suggestion.name)}&type=user`);
      const existingFood = foodsResponse.data?.find(food => 
        food.name.toLowerCase().includes(suggestion.name.toLowerCase()) ||
        suggestion.name.toLowerCase().includes(food.name.toLowerCase())
      );

      if (existingFood) {
        // Add existing food to meal
        await onAddFood({
          food_id: existingFood.id,
          quantity: 1
        });
        setMessage(`Added "${existingFood.name}" to ${selectedMeal.name}`);
      } else {
        // Create new food from AI suggestion
        const newFood = {
          name: suggestion.name,
          brand: 'AI Generated',
          serving_size: '1 serving',
          calories_per_serving: suggestion.calories || 0,
          protein_per_serving: suggestion.protein || 0,
          carbs_per_serving: suggestion.carbs || 0,
          fat_per_serving: suggestion.fat || 0
        };

        await api.post('/foods', newFood);
        
        // Get the newly created food to add to meal
        const updatedFoodsResponse = await api.get(`/foods?search=${encodeURIComponent(suggestion.name)}&type=user`);
        const newFoodFromDB = updatedFoodsResponse.data?.find(food => food.name === suggestion.name);
        
        if (newFoodFromDB) {
          await onAddFood({
            food_id: newFoodFromDB.id,
            quantity: 1
          });
          setMessage(`Added "${suggestion.name}" to your inventory and to ${selectedMeal.name}`);
        }
      }
      
      setShow(false);
      onRefresh();
    } catch (error) {
      console.error('Error adding AI suggestion:', error);
      setMessage('Failed to add AI suggestion to meal');
    } finally {
      setAddingFood(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 dark:text-white">AI Meal Suggestions</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Suggestion Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="daily">Daily Meal Plan</option>
              <option value="weekly">Weekly Meal Plan</option>
              <option value="meal">Specific Meal Ideas</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preferences (optional)
            </label>
            <input
              type="text"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="e.g., high protein, vegetarian, quick meals"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <button
          onClick={handleGetSuggestions}
          disabled={loading}
          className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Getting AI Suggestions...' : 'Get AI Suggestions'}
        </button>

        {message && (
          <div className={`p-3 rounded-md ${message.includes('Failed') ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
            {message}
          </div>
        )}

        {show && suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">AI Suggestions:</h4>
            {suggestions.map((suggestion, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white">{suggestion.name}</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{suggestion.description}</p>
                    {suggestion.calories && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Calories: {suggestion.calories} | 
                        Protein: {suggestion.protein}g | 
                        Carbs: {suggestion.carbs}g | 
                        Fat: {suggestion.fat}g
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcceptSuggestion(suggestion)}
                    className="ml-3 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    Add to Meal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AISuggestions;