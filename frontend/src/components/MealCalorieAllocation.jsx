import React, { useState, useEffect } from 'react';
import api from '../services/api';

const MealCalorieAllocation = ({ macroGoals, meals, onAllocationChange }) => {
  const [totalDailyCalories, setTotalDailyCalories] = useState(macroGoals?.calories || 2000);
  const [mealsRatio, setMealsRatio] = useState(0.75);
  const [snacksRatio, setSnacksRatio] = useState(0.25);
  const [mealTargets, setMealTargets] = useState({});
  const [useAutoCalculation, setUseAutoCalculation] = useState(true);
  const [customAllocations, setCustomAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Load current allocations on mount
  useEffect(() => {
    loadAllocations();
  }, []);

  // Calculate targets whenever ratios or calories change
  useEffect(() => {
    calculateTargets();
  }, [totalDailyCalories, mealsRatio, snacksRatio]);

  const loadAllocations = async () => {
    try {
      setLoading(true);
      const data = await api.get('/meal-calorie-allocations');
      if (data.total_daily_calories) {
        setTotalDailyCalories(data.total_daily_calories);
      }
      if (data.meals_ratio !== undefined) {
        setMealsRatio(data.meals_ratio);
      }
      if (data.snacks_ratio !== undefined) {
        setSnacksRatio(data.snacks_ratio);
      }
    } catch (error) {
      console.error('Error loading allocations:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAutoTargets = () => {
    if (!meals || meals.length === 0) return {};

    const targets = {};
    const mealCategories = {};

    // Group meals into "meal" vs "snack" categories
    meals.forEach(meal => {
      const category = meal.type === 'snack' ? 'snack' : 'meal';
      if (!mealCategories[category]) {
        mealCategories[category] = [];
      }
      mealCategories[category].push(meal);
    });

    // Calculate target calories for each meal
    meals.forEach(meal => {
      const category = meal.type === 'snack' ? 'snack' : 'meal';
      const count = mealCategories[category].length;
      const ratio = category === 'snack' ? snacksRatio : mealsRatio;
      const caloriesForCategory = totalDailyCalories * ratio;
      targets[meal.id] = Math.round(caloriesForCategory / count);
    });

    return targets;
  };

  const calculateTargets = () => {
    if (!meals || meals.length === 0) return;
    
    if (useAutoCalculation) {
      const targets = calculateAutoTargets();
      setMealTargets(targets);
      setCustomAllocations(targets);
    } else {
      // Use custom allocations
      setMealTargets(customAllocations);
    }

    if (onAllocationChange) {
      onAllocationChange({
        total_daily_calories: totalDailyCalories,
        meals_ratio: mealsRatio,
        snacks_ratio: snacksRatio,
        meal_targets: useAutoCalculation ? calculateAutoTargets() : customAllocations
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      await api.post('/meal-calorie-allocations', {
        total_daily_calories: totalDailyCalories,
        meals_ratio: mealsRatio,
        snacks_ratio: snacksRatio,
        use_auto_calculation: useAutoCalculation,
        custom_allocations: useAutoCalculation ? null : customAllocations
      });
      setMessage('Meal allocation saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save meal allocation');
    } finally {
      setSaving(false);
    }
  };

  const groupedMeals = meals && meals.length > 0 
    ? meals.reduce((acc, meal) => {
        if (!acc[meal.type]) acc[meal.type] = [];
        acc[meal.type].push(meal);
        return acc;
      }, {})
    : {};

  const snacksCount = (groupedMeals['snack'] || []).length;
  const mealsOnlyCount = meals.length - snacksCount;

  const mealsCalories = totalDailyCalories * mealsRatio;
  const snacksCalories = totalDailyCalories * snacksRatio;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Daily Calorie Allocation
      </h3>

      {message && (
        <div className={`mb-4 p-3 rounded-md ${message.includes('success') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
          {message}
        </div>
      )}

      {/* Auto-calculation checkbox at the top */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useAutoCalculation}
            onChange={(e) => {
              const checked = e.target.checked;
              setUseAutoCalculation(checked);
              if (!checked) {
                // When switching to manual, pre-populate sliders with auto-calculated values
                const autoTargets = calculateAutoTargets();
                setCustomAllocations(autoTargets);
                setMealTargets(autoTargets);
              }
            }}
            className="w-5 h-5 rounded"
          />
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Use Automatic Calculation</span>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Recommended: Automatically distribute calories based on meal/snack ratios
            </p>
          </div>
        </label>
      </div>

      {/* Show controls only when NOT using automatic calculation */}
      {!useAutoCalculation && (
      <div className="space-y-6">
        {/* Total Daily Calories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Total Daily Calories: <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalDailyCalories}</span>
          </label>
          <input
            type="number"
            min="1000"
            max="10000"
            step="50"
            value={totalDailyCalories}
            onChange={(e) => setTotalDailyCalories(parseInt(e.target.value) || 2000)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Meals vs Snacks Ratio */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Meals Allocation
              </label>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {Math.round(mealsRatio * 100)}% ({Math.round(mealsCalories)} cal / {mealsOnlyCount > 0 ? Math.round(mealsCalories / mealsOnlyCount) : 0} per meal)
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={mealsRatio}
              onChange={(e) => {
                const newMealsRatio = parseFloat(e.target.value);
                setMealsRatio(newMealsRatio);
                setSnacksRatio(1 - newMealsRatio);
              }}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Snacks Allocation
              </label>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {Math.round(snacksRatio * 100)}% ({Math.round(snacksCalories)} cal / {snacksCount > 0 ? Math.round(snacksCalories / snacksCount) : 0} per snack)
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={snacksRatio}
              onChange={(e) => {
                const newSnacksRatio = parseFloat(e.target.value);
                setSnacksRatio(newSnacksRatio);
                setMealsRatio(1 - newSnacksRatio);
              }}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>
        </div>

        {/* Individual Meal Sliders */}
        {meals && meals.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-4">
              ⚙️ Advanced: Adjust Individual Meals
            </p>
            <div className="space-y-4">
              {meals.map(meal => (
                <div key={meal.id}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {meal.name}
                    </label>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {customAllocations[meal.id] || 0} cal
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="50"
                    value={customAllocations[meal.id] || 0}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      setCustomAllocations(prev => ({
                        ...prev,
                        [meal.id]: newValue
                      }));
                      setMealTargets(prev => ({
                        ...prev,
                        [meal.id]: newValue
                      }));
                    }}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                </div>
              ))}
              <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Total: {Object.values(customAllocations).reduce((sum, val) => sum + (val || 0), 0)} cal
                  {Object.values(customAllocations).reduce((sum, val) => sum + (val || 0), 0) !== totalDailyCalories && (
                    <span className="ml-2 text-red-600 dark:text-red-400 font-bold">
                      (Target: {totalDailyCalories} cal)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Visual Breakdown */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Daily Breakdown:</p>
          <div className="flex gap-2 h-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
            <div
              className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
              style={{ width: `${mealsRatio * 100}%` }}
            >
              {Math.round(mealsRatio * 100)}%
            </div>
            <div
              className="bg-amber-500 flex items-center justify-center text-xs font-bold text-white"
              style={{ width: `${snacksRatio * 100}%` }}
            >
              {Math.round(snacksRatio * 100)}%
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>🍽️ Meals: {Math.round(mealsCalories)} cal ({mealsOnlyCount} meals × {mealsOnlyCount > 0 ? Math.round(mealsCalories / mealsOnlyCount) : 0} cal each)</p>
            {snacksCount > 0 && <p>🥗 Snacks: {Math.round(snacksCalories)} cal ({snacksCount} snacks × {Math.round(snacksCalories / snacksCount)} cal each)</p>}
          </div>
        </div>

        {/* Meal-by-Meal Targets */}
        {meals && meals.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Individual Meal Targets:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {meals.map(meal => (
                <div key={meal.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{meal.name}</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {mealTargets[meal.id] || 0} cal
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Target for AI suggestions
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                   disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors duration-200 font-medium"
        >
          {saving ? 'Saving...' : 'Save Allocation'}
        </button>
      </div>
      )}
    </div>
  );
};

export default MealCalorieAllocation;
