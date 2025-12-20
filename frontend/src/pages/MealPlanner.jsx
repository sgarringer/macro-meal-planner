import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import AISuggestions from '../components/AISuggestions';

const MealPlanner = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [meals, setMeals] = useState([]);
  const [foods, setFoods] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [macroGoals, setMacroGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showAddFood, setShowAddFood] = useState(false);
  const [message, setMessage] = useState('');
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScope, setAiScope] = useState('daily');
  const [aiPreferences, setAiPreferences] = useState('');

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    try {
      const [mealsRes, foodsRes, mealPlansRes, macroGoalsRes] = await Promise.all([
        api.get('/meals'),
        api.get('/foods?type=all'),
        api.get(`/meal-plans?date=${currentDate}`),
        api.get('/macro-goals')
      ]);

      setMeals(mealsRes.data);
      setFoods(foodsRes.data);
      setMealPlans(mealPlansRes.data);
      setMacroGoals(macroGoalsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage('Failed to load meal planner data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFoodToMeal = async (foodId, quantity) => {
    if (!selectedMeal) {
      setMessage('Please select a meal first');
      return;
    }

    try {
      await api.post('/meal-plans', {
        date: currentDate,
        meal_id: selectedMeal.id,
        food_id: foodId,
        quantity: quantity
      });

      setMessage('Food added to meal successfully');
      setShowAddFood(false);
      fetchData();
    } catch (error) {
      setMessage('Failed to add food to meal');
    }
  };

  const calculateDailyTotals = () => {
    const totals = mealPlans.reduce((acc, plan) => {
      const multiplier = plan.quantity;
      acc.calories += (plan.calories_per_serving || 0) * multiplier;
      acc.protein += (plan.protein_per_serving || 0) * multiplier;
      acc.carbs += (plan.carbs_per_serving || 0) * multiplier;
      acc.fat += (plan.fat_per_serving || 0) * multiplier;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return totals;
  };

  const getMacroProgress = (current, goal) => {
    if (!goal || goal === 0) return 0;
    return Math.min((current / goal) * 100, 100);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const dailyTotals = calculateDailyTotals();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Meal Planner
        </h1>
        <input
          type="date"
          value={currentDate}
          onChange={(e) => setCurrentDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.includes('success') 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          {message}
        </div>
      )}

      {/* Daily Summary */}
        {/* AI Suggestions */}
        <AISuggestions
          selectedMeal={selectedMeal}
          currentDate={currentDate}
          onAddFood={async (foodData) => {
            await api.post("/meal-plans", {
              date: currentDate,
              meal_id: selectedMeal.id,
              food_name: foodData.name,
              quantity: foodData.quantity || 1,
              notes: foodData.notes
            });
          }}
          onRefresh={fetchData}
        />

      {macroGoals && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Daily Macro Progress
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Calories</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(dailyTotals.calories)} / {macroGoals.calories}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${getProgressColor(getMacroProgress(dailyTotals.calories, macroGoals.calories))} h-2 rounded-full`}
                  style={{ width: `${getMacroProgress(dailyTotals.calories, macroGoals.calories)}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Protein</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {dailyTotals.protein.toFixed(1)}g / {macroGoals.protein}g
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${getProgressColor(getMacroProgress(dailyTotals.protein, macroGoals.protein))} h-2 rounded-full`}
                  style={{ width: `${getMacroProgress(dailyTotals.protein, macroGoals.protein)}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Carbs</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {dailyTotals.carbs.toFixed(1)}g / {macroGoals.carbs}g
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${getProgressColor(getMacroProgress(dailyTotals.carbs, macroGoals.carbs))} h-2 rounded-full`}
                  style={{ width: `${getMacroProgress(dailyTotals.carbs, macroGoals.carbs)}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fat</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {dailyTotals.fat.toFixed(1)}g / {macroGoals.fat}g
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${getProgressColor(getMacroProgress(dailyTotals.fat, macroGoals.fat))} h-2 rounded-full`}
                  style={{ width: `${getMacroProgress(dailyTotals.fat, macroGoals.fat)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meal Selection and Food Addition */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Add Foods to Meals
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <select
            value={selectedMeal?.id || ''}
            onChange={(e) => {
              const meal = meals.find(m => m.id === parseInt(e.target.value));
              setSelectedMeal(meal);
            }}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a meal</option>
            {meals.map(meal => (
              <option key={meal.id} value={meal.id}>
                {meal.name} ({meal.time_start} - {meal.time_end})
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddFood(true)}
            disabled={!selectedMeal}
            className="px-4 py-2 bg-blue-600 text-white rounded-md 
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            Add Food to {selectedMeal?.name || 'Meal'}
          </button>
        </div>
      </div>

      {/* Food Selection Modal */}
      {showAddFood && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Add Food to {selectedMeal?.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {foods.map(food => (
                  <div key={food.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">{food.name}</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {food.serving_size} | {food.calories_per_serving} cal
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        defaultValue="1"
                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <button
                        onClick={(e) => {
                          const quantity = parseFloat(e.target.previousElementSibling.value);
                          handleAddFoodToMeal(food.id, quantity);
                        }}
                        className="flex-1 px-2 py-1 bg-green-600 text-white text-sm rounded
                                 hover:bg-green-700 transition-colors duration-200"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAddFood(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meal Plans */}
      <div className="space-y-6">
        {meals.map(meal => {
          const mealPlansForMeal = mealPlans.filter(plan => plan.meal_id === meal.id);
          const mealTotals = mealPlansForMeal.reduce((acc, plan) => {
            const multiplier = plan.quantity;
            acc.calories += (plan.calories_per_serving || 0) * multiplier;
            acc.protein += (plan.protein_per_serving || 0) * multiplier;
            acc.carbs += (plan.carbs_per_serving || 0) * multiplier;
            acc.fat += (plan.fat_per_serving || 0) * multiplier;
            return acc;
          }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

          return (
            <div key={meal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {meal.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {meal.time_start} - {meal.time_end}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {Math.round(mealTotals.calories)} cal
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    P: {mealTotals.protein.toFixed(1)}g | C: {mealTotals.carbs.toFixed(1)}g | F: {mealTotals.fat.toFixed(1)}g
                  </div>
                </div>
              </div>

              {mealPlansForMeal.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No foods added to this meal yet
                </p>
              ) : (
                <div className="space-y-2">
                  {mealPlansForMeal.map(plan => (
                    <div key={plan.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {plan.food_name}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 ml-2">
                          {plan.quantity}x {plan.serving_size}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {Math.round((plan.calories_per_serving || 0) * plan.quantity)} cal
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          P: {((plan.protein_per_serving || 0) * plan.quantity).toFixed(1)}g | 
                          C: {((plan.carbs_per_serving || 0) * plan.quantity).toFixed(1)}g | 
                          F: {((plan.fat_per_serving || 0) * plan.quantity).toFixed(1)}g
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MealPlanner;