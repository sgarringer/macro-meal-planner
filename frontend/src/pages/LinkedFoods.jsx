import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const LinkedFoods = () => {
  const { user } = useAuth();
  const [linkedFoods, setLinkedFoods] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedFood, setExpandedFood] = useState(null);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    components: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [linkedFoodsRes, foodsRes] = await Promise.all([
        api.get('/linked-foods'),
        api.get('/foods?type=all')
      ]);

      setLinkedFoods(linkedFoodsRes);
      setFoods(foodsRes);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage('Failed to load linked foods');
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

  const handleAddComponent = () => {
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, { food_id: '', quantity: 1 }]
    }));
  };

  const handleComponentChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.map((comp, i) => 
        i === index ? { ...comp, [field]: value } : comp
      )
    }));
  };

  const handleRemoveComponent = (index) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      // Validate components
      const validComponents = formData.components.filter(comp => comp.food_id && comp.quantity > 0);
      if (validComponents.length === 0) {
        setMessage('Please add at least one valid component');
        return;
      }

      await api.post('/linked-foods', {
        name: formData.name,
        description: formData.description,
        components: validComponents
      });

      setMessage('Linked food created successfully');
      resetForm();
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to create linked food');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      components: []
    });
    setShowForm(false);
  };

  const fetchNutritionDetails = async (linkedFoodId) => {
    try {
      const response = await api.get(`/linked-foods/${linkedFoodId}/nutrition`);
      return response.data;
    } catch (error) {
      console.error('Error fetching nutrition details:', error);
      return null;
    }
  };

  const handleToggleExpand = async (linkedFood) => {
    if (expandedFood === linkedFood.id) {
      setExpandedFood(null);
    } else {
      setExpandedFood(linkedFood.id);
      // We could fetch detailed nutrition here if needed
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Linked Foods & Composite Meals
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md 
                   hover:bg-blue-700 transition-colors duration-200"
        >
          Create Linked Food
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Create Linked Food
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
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
                    Description (optional)
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe your composite meal..."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Components *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md 
                               hover:bg-green-700 transition-colors duration-200"
                    >
                      Add Component
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.components.map((component, index) => (
                      <div key={index} className="flex gap-3 items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <select
                          value={component.food_id}
                          onChange={(e) => handleComponentChange(index, 'food_id', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select a food</option>
                          {foods.map(food => (
                            <option key={food.id} value={food.id}>
                              {food.name} ({food.serving_size})
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={component.quantity}
                          onChange={(e) => handleComponentChange(index, 'quantity', parseFloat(e.target.value))}
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Qty"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveComponent(index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 
                                   dark:hover:bg-red-900 rounded transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {formData.components.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No components added yet. Click "Add Component" to get started.
                    </p>
                  )}
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
                    Create Linked Food
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Linked Foods List */}
      <div className="space-y-4">
        {linkedFoods.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No linked foods created yet. Create your first composite meal to get started.
            </p>
          </div>
        ) : (
          linkedFoods.map((linkedFood) => (
            <div key={linkedFood.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                onClick={() => handleToggleExpand(linkedFood)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {linkedFood.name}
                    </h3>
                    {linkedFood.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {linkedFood.description}
                      </p>
                    )}
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 
                                     px-2 py-1 rounded-full text-xs font-medium mr-3">
                        {linkedFood.components.length} components
                      </span>
                      <span>
                        Created {new Date(linkedFood.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        expandedFood === linkedFood.id ? 'transform rotate-180' : ''
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedFood === linkedFood.id && (
                <div className="border-t border-gray-200 dark:border-gray-600">
                  <div className="p-6">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                      Components & Nutrition
                    </h4>
                    
                    <div className="space-y-3">
                      {linkedFood.components.map((component, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {component.name}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400 ml-2">
                              {component.quantity}x
                            </span>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-gray-900 dark:text-white">
                              {Math.round((component.calories_per_serving || 0) * component.quantity)} cal
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              P: {((component.protein_per_serving || 0) * component.quantity).toFixed(1)}g | 
                              C: {((component.carbs_per_serving || 0) * component.quantity).toFixed(1)}g | 
                              F: {((component.fat_per_serving || 0) * component.quantity).toFixed(1)}g
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900 dark:text-white">Total Nutrition:</span>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {Math.round(linkedFood.components.reduce((sum, comp) => 
                              sum + (comp.calories_per_serving || 0) * comp.quantity, 0
                            ))} cal
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            P: {linkedFood.components.reduce((sum, comp) => 
                              sum + (comp.protein_per_serving || 0) * comp.quantity, 0
                            ).toFixed(1)}g | 
                            C: {linkedFood.components.reduce((sum, comp) => 
                              sum + (comp.carbs_per_serving || 0) * comp.quantity, 0
                            ).toFixed(1)}g | 
                            F: {linkedFood.components.reduce((sum, comp) => 
                              sum + (comp.fat_per_serving || 0) * comp.quantity, 0
                            ).toFixed(1)}g
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LinkedFoods;