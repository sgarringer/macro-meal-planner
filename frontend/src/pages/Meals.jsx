import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import MealCalorieAllocation from '../components/MealCalorieAllocation';

const Meals = () => {
  const { user } = useAuth();
  const [meals, setMeals] = useState([]);
  const [macroGoals, setMacroGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingMeal, setEditingMeal] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'breakfast',
    time_start: '07:00',
    time_end: '09:00',
    protein_percentage: 25,
    carbs_percentage: 50,
    fat_percentage: 25,
    preferences: ''
  });

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' }
  ];

  useEffect(() => {
    fetchMeals();
    fetchMacroGoals();
  }, []);

  const fetchMacroGoals = async () => {
    try {
      const response = await api.get('/macro-goals');
      setMacroGoals(response);
    } catch (error) {
      console.error('Error fetching macro goals:', error);
    }
  };

  const fetchMeals = async () => {
    try {
      const response = await api.get('/meals');
      setMeals(response || []);
    } catch (error) {
      console.error('Error fetching meals:', error);
      setMessage('Failed to fetch meals');
      setMeals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      // Validate percentages sum to 100
      const totalPercentage = 
        parseFloat(formData.protein_percentage) + 
        parseFloat(formData.carbs_percentage) + 
        parseFloat(formData.fat_percentage);

      if (Math.abs(totalPercentage - 100) > 0.1) {
        setMessage('Macro percentages must sum to 100%');
        return;
      }

      if (editingMeal) {
        await api.put(`/meals/${editingMeal.id}`, formData);
        setMessage('Meal updated successfully');
      } else {
        await api.post('/meals', formData);
        setMessage('Meal created successfully');
      }

      resetForm();
      fetchMeals();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save meal');
    }
  };

  const handleEdit = (meal) => {
    setEditingMeal(meal);
    setFormData({
      name: meal.name,
      type: meal.type,
      time_start: meal.time_start,
      time_end: meal.time_end,
      protein_percentage: meal.protein_percentage || 25,
      carbs_percentage: meal.carbs_percentage || 50,
      fat_percentage: meal.fat_percentage || 25,
      preferences: meal.preferences || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (mealId) => {
    if (!confirm('Are you sure you want to delete this meal?')) {
      return;
    }

    try {
      await api.delete(`/meals/${mealId}`);
      setMessage('Meal deleted successfully');
      fetchMeals();
    } catch (error) {
      setMessage('Failed to delete meal');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'breakfast',
      time_start: '07:00',
      time_end: '09:00',
      protein_percentage: 25,
      carbs_percentage: 50,
      fat_percentage: 25,
      preferences: ''
    });
    setEditingMeal(null);
    setShowForm(false);
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Meal Configuration
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md 
                   hover:bg-blue-700 transition-colors duration-200"
        >
          Add Meal
        </button>
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

      {/* Meal Calorie Allocation */}
      {macroGoals && <MealCalorieAllocation macroGoals={macroGoals} meals={meals} />}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                {editingMeal ? 'Edit Meal' : 'Add New Meal'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meal Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meal Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {mealTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      name="time_start"
                      value={formData.time_start}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      name="time_end"
                      value={formData.time_end}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Macro Distribution
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Protein %
                      </label>
                      <input
                        type="number"
                        name="protein_percentage"
                        value={formData.protein_percentage}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Carbs %
                      </label>
                      <input
                        type="number"
                        name="carbs_percentage"
                        value={formData.carbs_percentage}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Fat %
                      </label>
                      <input
                        type="number"
                        name="fat_percentage"
                        value={formData.fat_percentage}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    Total: {parseFloat(formData.protein_percentage || 0) + 
                            parseFloat(formData.carbs_percentage || 0) + 
                            parseFloat(formData.fat_percentage || 0)}%
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Preferences (optional)
                  </label>
                  <textarea
                    name="preferences"
                    value={formData.preferences}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Prefer vegetarian options, avoid spicy food..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                             transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md 
                             hover:bg-blue-700 transition-colors duration-200"
                  >
                    {editingMeal ? 'Update Meal' : 'Create Meal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Meals List */}
      <div className="space-y-4">
        {meals.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No meals configured yet. Create your first meal to get started.
            </p>
          </div>
        ) : (
          meals.map((meal) => (
            <div key={meal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {meal.name}
                    </h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 
                                   text-xs font-medium rounded-full">
                      {mealTypes.find(t => t.value === meal.type)?.label}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <div>
                      Time: {meal.time_start} - {meal.time_end}
                    </div>
                    <div>
                      Macros: {meal.protein_percentage}%P / {meal.carbs_percentage}%C / {meal.fat_percentage}%F
                    </div>
                    {meal.preferences && (
                      <div>
                        Preferences: {meal.preferences}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(meal)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 
                             dark:hover:bg-blue-900 rounded transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(meal.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 
                             dark:hover:bg-red-900 rounded transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Meals;