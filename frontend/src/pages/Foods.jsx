import React, { useState, useEffect, useRef } from 'react';
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
  const [editingFood, setEditingFood] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    serving_size: '',
    calories_per_serving: '',
    protein_per_serving: '',
    carbs_per_serving: '',
    fat_per_serving: '',
    fiber_per_serving: ''
  });
  const [labelStatus, setLabelStatus] = useState('');
  const [labelParsing, setLabelParsing] = useState(false);
  const [labelPreview, setLabelPreview] = useState(null);
  const labelInputRef = useRef(null);

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
      setFoods(response || []);
      setFilteredFoods(response || []);
    } catch (error) {
      console.error('Error fetching foods:', error);
      setMessage('Failed to fetch foods');
      setFoods([]);
      setFilteredFoods([]);
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
    setLabelStatus('');

    try {
      const foodData = {
        ...formData,
        calories_per_serving: parseInt(formData.calories_per_serving),
        protein_per_serving: parseFloat(formData.protein_per_serving),
        carbs_per_serving: parseFloat(formData.carbs_per_serving),
        fat_per_serving: parseFloat(formData.fat_per_serving),
        fiber_per_serving: parseFloat(formData.fiber_per_serving)
      };

      if (editingFood) {
        await api.put(`/foods/${editingFood.id}`, foodData);
        setMessage('Food updated successfully');
      } else {
        await api.post('/foods', foodData);
        setMessage('Food created successfully');
      }

      resetForm();
      fetchFoods();
    } catch (error) {
      setMessage(error.response?.data?.error || `Failed to ${editingFood ? 'update' : 'create'} food`);
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
      fat_per_serving: '',
      fiber_per_serving: ''
    });
    setLabelPreview(null);
    setLabelStatus('');
    setLabelParsing(false);
    setShowForm(false);
    setEditingFood(null);
  };

  const handleEditFood = (food) => {
    setFormData({
      name: food.name,
      brand: food.brand || '',
      serving_size: food.serving_size,
      calories_per_serving: food.calories_per_serving.toString(),
      protein_per_serving: food.protein_per_serving.toString(),
      carbs_per_serving: food.carbs_per_serving.toString(),
      fat_per_serving: food.fat_per_serving.toString(),
      fiber_per_serving: food.fiber_per_serving.toString()
    });
    setLabelPreview(null);
    setLabelStatus('');
    setEditingFood(food);
    setShowForm(true);
  };

  const handleLabelFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (labelPreview) {
      URL.revokeObjectURL(labelPreview);
    }

    setLabelPreview(URL.createObjectURL(file));
    setLabelStatus('Parsing label...');
    setLabelParsing(true);

    const upload = new FormData();
    upload.append('image', file);
    upload.append('name', formData.name);
    upload.append('brand', formData.brand);

    try {
      const response = await api.post('/foods/label/parse', upload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      const fields = response?.data?.fields || response?.fields;
      if (fields) {
        setFormData((prev) => ({
          ...prev,
          serving_size: fields.serving_size || prev.serving_size,
          calories_per_serving: fields.calories_per_serving?.toString() || prev.calories_per_serving,
          protein_per_serving: fields.protein_per_serving?.toString() || prev.protein_per_serving,
          carbs_per_serving: fields.carbs_per_serving?.toString() || prev.carbs_per_serving,
          fat_per_serving: fields.fat_per_serving?.toString() || prev.fat_per_serving,
          fiber_per_serving: fields.fiber_per_serving?.toString() || prev.fiber_per_serving
        }));
        setLabelStatus('Label parsed');
      } else {
        setLabelStatus('No data found on label');
      }
    } catch (err) {
      console.error('Label parse failed', err);
      setLabelStatus(err?.response?.data?.error || 'Label parse failed');
      setLabelPreview(null);
    } finally {
      setLabelParsing(false);
      e.target.value = '';
    }
  };

  const handleDeleteFood = async (foodId) => {
    if (!window.confirm('Are you sure you want to delete this food?')) {
      return;
    }

    try {
      await api.delete(`/foods/${foodId}`);
      setMessage('Food deleted successfully');
      fetchFoods();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to delete food');
    }
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
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-10 mx-auto">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-10 mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Food Catalog
        </h1>
        <button
          onClick={() => {
            setEditingFood(null);
            setShowForm(true);
          }}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md 
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
                {editingFood ? 'Edit Food' : 'Add New Food'}
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

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => labelInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 5a2 2 0 012-2h1.172a2 2 0 001.414-.586l.828-.828A2 2 0 0111.828 1H14a2 2 0 012 2v1h1a2 2 0 012 2v7a2 2 0 01-2 2h-1v1a2 2 0 01-2 2h-3.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 008.172 17H7a2 2 0 01-2-2v-1H4a2 2 0 01-2-2V7a2 2 0 012-2h1V5zm6 9a4 4 0 100-8 4 4 0 000 8z" />
                    </svg>
                    Scan nutrition label
                  </button>
                  <input
                    ref={labelInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleLabelFileChange}
                  />
                  {(labelStatus || labelParsing) && (
                    <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      {labelParsing && (
                        <span className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-label="Parsing label" />
                      )}
                      <span>{labelStatus || 'Parsing label...'}</span>
                    </span>
                  )}
                </div>
                {labelPreview && (
                  <div className="mt-2">
                    <img src={labelPreview} alt="Label preview" className="h-24 rounded-md border border-gray-200 dark:border-gray-700" />
                  </div>
                )}

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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fiber (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="fiber_per_serving"
                      value={formData.fiber_per_serving}
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
                    {editingFood ? 'Update Food' : 'Add Food'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Food List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        {filteredFoods.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No foods found matching your search.' : 'No foods available.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="w-[20%] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Food
                  </th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Serving
                  </th>
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cal
                  </th>
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Prot
                  </th>
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Carbs
                  </th>
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fat
                  </th>
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fiber
                  </th>
                  <th className="w-[10%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="w-[10%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[8%] px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredFoods.map((food) => (
                  <tr 
                    key={food.id} 
                    onClick={() => food.user_id && handleEditFood(food)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${food.user_id ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <div className="truncate">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {food.name}
                        </div>
                        {food.brand && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {food.brand}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-300 truncate">
                      {food.serving_size}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {food.calories_per_serving}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {food.protein_per_serving}g
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {food.carbs_per_serving}g
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {food.fat_per_serving}g
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {food.fiber_per_serving}g
                    </td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        food.is_common 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {food.is_common ? 'Common' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFood(food.id);
                        }}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transition-colors duration-200 ${
                          food.active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {food.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-sm text-center">
                      {food.user_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFood(food.id);
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete food"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
          </div>

            {/* Mobile cards */}
            <div className="block sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {filteredFoods.map((food) => (
                <div key={food.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-gray-900 dark:text-white">{food.name}</div>
                      {food.brand && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{food.brand}</div>
                      )}
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{food.serving_size}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex px-2 py-1 text-[11px] font-semibold rounded-full ${
                        food.is_common 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {food.is_common ? 'Common' : 'Custom'}
                      </span>
                      <button
                        onClick={() => handleToggleFood(food.id)}
                        className={`inline-flex px-3 py-1 text-[11px] font-semibold rounded-full transition-colors duration-200 ${
                          food.active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {food.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <div>Cal: {food.calories_per_serving}</div>
                    <div>Protein: {food.protein_per_serving}g</div>
                    <div>Carbs: {food.carbs_per_serving}g</div>
                    <div>Fat: {food.fat_per_serving}g</div>
                    <div>Fiber: {food.fiber_per_serving}g</div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => food.user_id && handleEditFood(food)}
                      className={`flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 ${
                        food.user_id
                          ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                          : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={!food.user_id}
                    >
                      {food.user_id ? 'Edit' : 'View Only'}
                    </button>
                    {food.user_id && (
                      <button
                        onClick={() => handleDeleteFood(food.id)}
                        className="px-3 py-2 text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-gray-700 rounded-md"
                        title="Delete food"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Foods;