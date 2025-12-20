import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Foods = () => {
  const { user } = useAuth();
  const [foods, setFoods] = useState([]);
  const [filteredFoods, setFilteredFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    serving_size: '',
    calories_per_serving: '',
    protein_per_serving: '',
    carbs_per_serving: '',
    fat_per_serving: ''
  });

  useEffect(() => {
    fetchFoods();
  }, [filterType]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = foods.filter(food =>
        food.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (food.brand && food.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredFoods(filtered);
    } else {
      setFilteredFoods(foods);
    }
  }, [searchTerm, foods]);

  const fetchFoods = async () => {
    try {
      let url = '/foods';
      if (filterType !== 'all') {
        url += `?type=${filterType}`;
      }
      const response = await api.get(url);
      setFoods(response.data);
      setFilteredFoods(response.data);
    } catch (error) {
      console.error('Error fetching foods:', error);
      setMessage('Failed to fetch foods');
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
      await api.post('/foods', {
        ...formData,
        calories_per_serving: parseInt(formData.calories_per_serving),
        protein_per_serving: parseFloat(formData.protein_per_serving),
        carbs_per_serving: parseFloat(formData.carbs_per_serving),
        fat_per_serving: parseFloat(formData.fat_per_serving)
      });

      setMessage('Food created successfully');
      resetForm();
      fetchFoods();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to create food');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      serving_size: '',
      calories_per_serving: '',
      protein_per_serving: '',
      carbs_per_serving: '',
      fat_per_serving: ''
    });
    setShowForm(false);
  };

  const calculateCaloriesFromMacros = () => {
    const protein = parseFloat(formData.protein_per_serving) || 0;
    const carbs = parseFloat(formData.carbs_per_serving) || 0;
    const fat = parseFloat(formData.fat_per_serving) || 0;
    return Math.round(protein * 4 + carbs * 4 + fat * 9);
  };

  const handleToggleFood = async (foodId) => {
    try {
      await api.put(`/foods/${foodId}/toggle`);
      setMessage('Food status updated successfully');
      fetchFoods();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to update food status');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Food Catalog
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md 
                   hover:bg-blue-700 transition-colors duration-200"
        >
          Add Food
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

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search foods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Foods</option>
              <option value="common">Common Foods</option>
              <option value="user">My Foods</option>
            </select>
          </div>
        </div>
      </div>

      {/* Food Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Add New Food
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Food Name *
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
                      Brand (optional)
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Serving Size *
                  </label>
                  <input
                    type="text"
                    name="serving_size"
                    value={formData.serving_size}
                    onChange={handleInputChange}
                    placeholder="e.g., 1 cup, 100g, 2 slices"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Calories *
                    </label>
                    <input
                      type="number"
                      name="calories_per_serving"
                      value={formData.calories_per_serving}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Protein (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="protein_per_serving"
                      value={formData.protein_per_serving}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Carbs (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="carbs_per_serving"
                      value={formData.carbs_per_serving}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fat (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="fat_per_serving"
                      value={formData.fat_per_serving}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {formData.protein_per_serving && formData.carbs_per_serving && formData.fat_per_serving && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Calculated calories: {calculateCaloriesFromMacros()} kcal
                  </div>
                )}

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
                    Add Food
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Food List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {filteredFoods.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No foods found matching your search.' : 'No foods available.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Food
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Serving Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Calories
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Protein
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Carbs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredFoods.map((food) => (
                  <tr key={food.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {food.name}
                        </div>
                        {food.brand && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {food.brand}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {food.serving_size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {food.calories_per_serving}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {food.protein_per_serving}g
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {food.carbs_per_serving}g
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {food.fat_per_serving}g
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        food.is_common 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {food.is_common ? 'Common' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleFood(food.id)}
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 ${
                          food.active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {food.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Foods;