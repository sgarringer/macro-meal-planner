import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const MealPlanner = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => {
    const stored = localStorage.getItem('mealPlannerDate');
    return stored || new Date().toISOString().split('T')[0];
  });
  const [meals, setMeals] = useState([]);
  const [foods, setFoods] = useState([]);
  const [linkedFoods, setLinkedFoods] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [macroGoals, setMacroGoals] = useState(null);
  const [mealCalorieTargets, setMealCalorieTargets] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showAddFood, setShowAddFood] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [foodSortBy, setFoodSortBy] = useState('name');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiContext, setAiContext] = useState({ type: '', mealId: null, mode: 'meal' });
  const [aiPreferences, setAiPreferences] = useState('');
  const [targetCalories, setTargetCalories] = useState('');
  const [allowNewFoods, setAllowNewFoods] = useState(false);
  const [openAIDropdown, setOpenAIDropdown] = useState(null);
  const [message, setMessage] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiTotals, setAiTotals] = useState(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState({}); // { mealId: [indices] }
  const [aiDebugPrompt, setAiDebugPrompt] = useState('');
  const [aiRawResponse, setAiRawResponse] = useState('');
  

    // Track active AI requests by meal ID: { mealId: { requestId, status, suggestions } }
    const [activeAiRequests, setActiveAiRequests] = useState({});
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [editingServings, setEditingServings] = useState(null); // { mealPlanId, quantity }
    const [draggedItem, setDraggedItem] = useState(null); // { mealPlanId, foodName }

  // Restore active AI requests from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('activeAiRequests');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Restoring AI requests from localStorage:', parsed);
        
        // Filter out stale/completed requests before restoring
        const validRequests = {};
        const restoredSelections = {}; // Track selections for ready requests
        Object.keys(parsed).forEach(mealId => {
          const request = parsed[mealId];
          if (request.requestId && request.status !== 'ready' && request.status !== 'cancelled' && request.status !== 'error') {
            validRequests[mealId] = request;
            console.log(`Starting poll for meal ${mealId}, request ${request.requestId}, status: ${request.status}`);
            pollRequestStatus(request.requestId, parseInt(mealId));
          } else if (request.status === 'ready' && Array.isArray(request.suggestions)) {
            // For ready requests with suggestions, restore them and auto-check
            validRequests[mealId] = request;
            console.log(`Restored ready meal ${mealId} with ${request.suggestions.length} suggestions`);
            // Auto-check all suggestions for this meal
            restoredSelections[mealId] = request.suggestions.map((_, i) => i);
          } else {
            console.log(`Skipping meal ${mealId} - status is ${request.status}`);
          }
        });
        
        setActiveAiRequests(validRequests);
        setSelectedSuggestions(restoredSelections);
      } catch (e) {
        console.error('Failed to restore AI requests:', e);
        localStorage.removeItem('activeAiRequests');
      }
    }
  }, []);

  // Load meal planner data on mount and when date changes
  useEffect(() => {
    fetchData();
  }, [currentDate]);

  // Remote search against unified foods endpoint (debounced), only when modal is open
  useEffect(() => {
    if (!showAddFood) return;

    const timeout = setTimeout(async () => {
      try {
        const query = foodSearch ? `?search=${encodeURIComponent(foodSearch)}` : '';
        const res = await api.get(`/foods/all${query}`);
        setFoods(res?.foods || []);
        setLinkedFoods(res?.linkedFoods || []);
      } catch (err) {
        console.error('Food search failed:', err);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [foodSearch, showAddFood]);

  // Persist current date to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mealPlannerDate', currentDate);
  }, [currentDate]);

  // Persist active requests to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(activeAiRequests).length > 0) {
      localStorage.setItem('activeAiRequests', JSON.stringify(activeAiRequests));
    } else {
      localStorage.removeItem('activeAiRequests');
    }
  }, [activeAiRequests]);

  const fetchData = async () => {
    try {
      const [mealsRes, unifiedFoodsRes, mealPlansRes, macroGoalsRes, mealTargetsRes] = await Promise.all([
        api.get('/meals'),
        api.get('/foods/all'),
        api.get(`/meal-plans?date=${currentDate}`),
        api.get('/macro-goals'),
        api.get('/meals/calorie-targets')
      ]);

      setMeals(mealsRes || []);
      setFoods(unifiedFoodsRes?.foods || []);
      setLinkedFoods(unifiedFoodsRes?.linkedFoods || []);
      setMealPlans(mealPlansRes || []);
      setMacroGoals(macroGoalsRes || null);
      setMealCalorieTargets(mealTargetsRes?.meal_targets || {});
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage('Failed to load meal planner data');
      setMeals([]);
      setFoods([]);
      setMealPlans([]);
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

  // Add a linked food by expanding its components into meal plan entries
  const handleAddLinkedFoodToMeal = async (linkedFood, quantity) => {
    if (!selectedMeal) {
      setMessage('Please select a meal first');
      return;
    }

    const components = Array.isArray(linkedFood?.components) ? linkedFood.components : [];
    const validComponents = components.filter(c => c.id);
    if (validComponents.length === 0) {
      setMessage('Linked food has no components to add');
      return;
    }

    try {
      await Promise.all(validComponents.map(comp => {
        const componentQuantity = (comp.quantity || 1) * (quantity || 1);
        return api.post('/meal-plans', {
          date: currentDate,
          meal_id: selectedMeal.id,
          food_id: comp.id,
          quantity: componentQuantity
        });
      }));

      setMessage('Linked food added to meal successfully');
      setShowAddFood(false);
      fetchData();
    } catch (error) {
      console.error('Failed to add linked food to meal:', error);
      setMessage('Failed to add linked food to meal');
    }
  };

  const handleRemoveFoodFromMeal = async (mealPlanId) => {
    try {
      await api.delete(`/meal-plans/${mealPlanId}`);
      setMessage('Food removed from meal successfully');
      fetchData();
    } catch (error) {
      setMessage('Failed to remove food from meal');
    }
  };

  const handleUpdateServings = async (mealPlanId, newQuantity) => {
    if (newQuantity < 0.5) {
      setMessage('Quantity must be at least 0.5');
      return;
    }

    try {
      await api.put(`/meal-plans/${mealPlanId}`, { quantity: newQuantity });
      setMessage('Servings updated successfully');
      setEditingServings(null);
      fetchData();
    } catch (error) {
      setMessage('Failed to update servings');
    }
  };

  const handleMoveFood = async (mealPlanId, newMealId) => {
    try {
      await api.post(`/meal-plans/${mealPlanId}/move`, { newMealId });
      setMessage('Food moved to meal successfully');
      setDraggedItem(null);
      fetchData();
    } catch (error) {
      setMessage('Failed to move food');
    }
  };

  const pollRequestStatus = async (requestId, mealId) => {
    try {
      const token = localStorage.getItem('authToken');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      
      const response = await fetch(`${baseURL}/ai/status/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Request not found on backend, clear it
        console.log(`Request ${requestId} not found on backend (${response.status}), removing from state`);
        setActiveAiRequests(prev => {
          const updated = { ...prev };
          delete updated[mealId];
          return updated;
        });
        return;
      }

      const data = await response.json();
      
      // Check if ready but with invalid suggestions
      if (data.status === 'ready' && (!data.suggestions || !Array.isArray(data.suggestions) || data.suggestions.length === 0)) {
        // Treat as error - show briefly then remove
        console.log(`Request ${requestId} completed with invalid/empty suggestions, marking as error`);
        setActiveAiRequests(prev => ({
          ...prev,
          [mealId]: {
            ...prev[mealId],
            status: 'error'
          }
        }));
        
        setTimeout(() => {
          setActiveAiRequests(prev => {
            const updated = { ...prev };
            delete updated[mealId];
            return updated;
          });
        }, 2000);
        return;
      }
      
      // Update status
      setActiveAiRequests(prev => ({
        ...prev,
        [mealId]: {
          ...prev[mealId],
          status: data.status,
          suggestions: (data.suggestions && Array.isArray(data.suggestions)) ? data.suggestions : (prev[mealId]?.suggestions || null),
          debugPrompt: data.debugPrompt || prev[mealId]?.debugPrompt,
          rawResponse: data.rawResponse || prev[mealId]?.rawResponse
        }
      }));

      // If ready, set the debug info
      if (data.status === 'ready' && data.suggestions) {
        setAiDebugPrompt(data.debugPrompt || '');
        setAiRawResponse(data.rawResponse || '');
      }

      // If error or cancelled, show briefly then auto-remove
      if (data.status === 'error' || data.status === 'cancelled') {
        setTimeout(() => {
          setActiveAiRequests(prev => {
            const updated = { ...prev };
            delete updated[mealId];
            return updated;
          });
        }, 2000);
        return;
      }

      // If not finished, poll again
      if (data.status !== 'ready' && data.status !== 'cancelled' && data.status !== 'error') {
        setTimeout(() => pollRequestStatus(requestId, mealId), 2000);
      }
    } catch (error) {
      console.error('Error polling request status:', error);
      // Clear the request on error
      setActiveAiRequests(prev => {
        const updated = { ...prev };
        delete updated[mealId];
        return updated;
      });
    }
  };

  const handlePlanMeal = async () => {
    if (!selectedMeal) {
      setAiError('No meal selected');
      return;
    }

    if (!targetCalories || targetCalories <= 0) {
      setAiError('Please enter a valid target calorie amount');
      return;
    }

    setAiError('');
    setAiStatus('Starting AI meal planning...');
    setAiSuggestions([]);
    setAiTotals(null);
    setShowAISuggestions(false); // Changed to false - we'll show inline
    setShowAIModal(false); // Close the modal - run in background
    setAiDebugPrompt('');
    setAiRawResponse('');

    let requestId = null;
    try {
      const token = localStorage.getItem('authToken');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      
      const response = await fetch(`${baseURL}/ai/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          meal_id: selectedMeal.id,
          target_calories: parseInt(targetCalories),
          preferences: aiPreferences || undefined,
          date: currentDate,
          allow_new_foods: !!allowNewFoods,
          mode: aiContext.mode || 'meal'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start meal planning');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by double newlines
        let eventBoundary;
        while ((eventBoundary = buffer.indexOf('\n\n')) !== -1) {
          const eventChunk = buffer.slice(0, eventBoundary);
          buffer = buffer.slice(eventBoundary + 2);

          // Each event might have multiple lines, we care about lines starting with 'data: '
          const eventLines = eventChunk.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Capture request ID from first response
                if (data.requestId && !requestId) {
                  requestId = data.requestId;
                  setActiveAiRequests(prev => ({
                    ...prev,
                    [selectedMeal.id]: {
                      requestId,
                      status: data.status || 'queued',
                      suggestions: null
                    }
                  }));
                }

                // Update request status
                if (requestId && data.requestId === requestId && data.status) {
                  setActiveAiRequests(prev => ({
                    ...prev,
                    [selectedMeal.id]: {
                      ...prev[selectedMeal.id],
                      status: data.status
                    }
                  }));
                }
                if (data.status === 'complete' && data.suggestions) {
                  setAiSuggestions(data.suggestions);
                  setAiTotals(data.totals);
                  setSelectedSuggestions(prev => ({ ...prev, [selectedMeal.id]: Array.isArray(data.suggestions) ? data.suggestions.map((_, i) => i) : [] }));
                  setAiStatus('Meal plan ready! Review and adjust quantities below.');
                                } else if (data.status === 'ready' && data.suggestions) {
                                  setAiSuggestions(data.suggestions);
                                  setAiTotals(data.totals);
                                  setSelectedSuggestions(prev => ({ ...prev, [selectedMeal.id]: Array.isArray(data.suggestions) ? data.suggestions.map((_, i) => i) : [] }));
                                  setAiStatus('Meal plan ready! Review and adjust quantities below.');
                                  // Update active request with suggestions
                                  if (requestId) {
                                    setActiveAiRequests(prev => ({
                                      ...prev,
                                      [selectedMeal.id]: {
                                        ...prev[selectedMeal.id],
                                        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
                                        totals: data.totals
                                      }
                                    }));
                                  }
                } else if (data.debug_prompt) {
                  setAiDebugPrompt(data.debug_prompt);
                } else if (data.raw_response) {
                  setAiRawResponse(data.raw_response);
                } else if (data.status) {
                  setAiStatus(data.status);
                } else if (data.error) {
                  setAiError(data.error);
                  setAiStatus('');
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('AI error:', error);
      setAiError(error.message || 'Failed to generate meal plan');
      setAiStatus('');
    }
  };

  const handleAddSuggestionsToMeal = async (mealIdParam = null) => {
    const mealIdToUse = mealIdParam || selectedMeal?.id;
    if (!mealIdToUse) return;

    try {
      // Use suggestions from activeAiRequests if available (restored from localStorage)
      // Otherwise use aiSuggestions (from SSE)
      const suggestionsToUse = activeAiRequests[mealIdToUse]?.suggestions || aiSuggestions;
      const indicesToAdd = selectedSuggestions[mealIdToUse] || [];
      
      for (const index of indicesToAdd) {
        const suggestion = suggestionsToUse[index];

        // New food suggestion path
        if (suggestion.is_new) {
          const newFoodRes = await api.post('/foods', {
            name: suggestion.name,
            brand: '',
            serving_size: suggestion.serving_size,
            calories_per_serving: Math.round(suggestion.calories / suggestion.quantity),
            protein_per_serving: Number((suggestion.protein / suggestion.quantity).toFixed(1)),
            carbs_per_serving: Number((suggestion.carbs / suggestion.quantity).toFixed(1)),
            fat_per_serving: Number((suggestion.fat / suggestion.quantity).toFixed(1)),
            fiber_per_serving: Number((suggestion.fiber / suggestion.quantity).toFixed(1))
          });
          const newFoodId = newFoodRes?.food?.id;
          if (!newFoodId) throw new Error('Failed to create new food');

          await api.post('/meal-plans', {
            date: currentDate,
            meal_id: mealIdToUse,
            food_id: parseInt(newFoodId),
            quantity: suggestion.quantity
          });
          continue;
        }

        // Linked food path: expand via backend
        let foodId = suggestion.food_id;
        if (typeof foodId === 'string' && foodId.startsWith('linked_')) {
          const linkedId = parseInt(foodId.replace('linked_', ''), 10);
          await api.post('/meal-plans/add-linked', {
            date: currentDate,
            meal_id: mealIdToUse,
            linked_food_id: linkedId,
            quantity: suggestion.quantity
          });
          continue;
        }

        // Regular food path
        await api.post('/meal-plans', {
          date: currentDate,
          meal_id: mealIdToUse,
          food_id: parseInt(foodId),
          quantity: suggestion.quantity
        });
      }

      setMessage('Suggested foods added to meal successfully');
      setShowAIModal(false);
      setShowAISuggestions(false);
      setAiSuggestions([]);
      setSelectedSuggestions(prev => {
        const updated = { ...prev };
        delete updated[mealIdToUse];
        return updated;
      });
      setTargetCalories('');
      setAiPreferences('');
      setAllowNewFoods(false);
      
      // Clear the AI request placeholder for this meal
      if (mealIdToUse) {
        setActiveAiRequests(prev => {
          const updated = { ...prev };
          delete updated[mealIdToUse];
          return updated;
        });
      }
      
      fetchData();
    } catch (error) {
      setMessage('Failed to add some foods to meal');
      console.error('Error adding foods:', error);
    }
  };

  const handleCancelAiRequest = async (mealId) => {
    const request = activeAiRequests[mealId];
    if (!request || !request.requestId) return;

    try {
      const token = localStorage.getItem('authToken');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  
      await fetch(`${baseURL}/ai/cancel/${request.requestId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Show "Cancelled" briefly then remove
      setActiveAiRequests(prev => ({
        ...prev,
        [mealId]: {
          ...prev[mealId],
          status: 'cancelled'
        }
      }));

      // Auto-remove after 1 second
      setTimeout(() => {
        setActiveAiRequests(prev => {
          const updated = { ...prev };
          delete updated[mealId];
          return updated;
        });
        setAiStatus('');
        setAiError('');
        setShowAISuggestions(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  };

  const handleGetMoreSuggestions = async (mealId) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;

    // Get the current suggestions to exclude
    const currentSuggestions = activeAiRequests[mealId]?.suggestions || [];
    const excludeIds = currentSuggestions
      .map(s => s.food_id)
      .filter(id => id && !String(id).startsWith('linked_'))
      .map(id => parseInt(id));

    // Clear the inline results and reset for new request
    setActiveAiRequests(prev => {
      const updated = { ...prev };
      delete updated[mealId];
      return updated;
    });
    setSelectedSuggestions(prev => {
      const updated = { ...prev };
      delete updated[mealId];
      return updated;
    });

    // Trigger a new AI request with excluded foods
    try {
      const token = localStorage.getItem('authToken');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      
      const response = await fetch(`${baseURL}/ai/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          meal_id: mealId,
          target_calories: parseInt(targetCalories) || mealCalorieTargets[mealId] || 750,
          preferences: aiPreferences || undefined,
          date: currentDate,
          allow_new_foods: !!allowNewFoods,
          mode: aiContext.mode || 'meal',
          exclude_food_ids: excludeIds.length > 0 ? excludeIds : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start meal planning');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let eventBoundary;
        while ((eventBoundary = buffer.indexOf('\n\n')) !== -1) {
          const eventChunk = buffer.slice(0, eventBoundary);
          buffer = buffer.slice(eventBoundary + 2);

          const eventLines = eventChunk.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.requestId) {
                  setActiveAiRequests(prev => ({
                    ...prev,
                    [mealId]: {
                      requestId: data.requestId,
                      status: data.status || 'queued',
                      suggestions: null
                    }
                  }));
                }

                if (data.status && data.requestId) {
                  setActiveAiRequests(prev => ({
                    ...prev,
                    [mealId]: {
                      ...prev[mealId],
                      status: data.status
                    }
                  }));
                }

                if (data.status === 'ready' && data.suggestions) {
                  setSelectedSuggestions(prev => ({ 
                    ...prev, 
                    [mealId]: Array.isArray(data.suggestions) ? data.suggestions.map((_, i) => i) : [] 
                  }));
                  setActiveAiRequests(prev => ({
                    ...prev,
                    [mealId]: {
                      ...prev[mealId],
                      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
                      debugPrompt: data.debugPrompt,
                      rawResponse: data.rawResponse
                    }
                  }));
                  setAiDebugPrompt(data.debugPrompt || '');
                  setAiRawResponse(data.rawResponse || '');
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to get more suggestions:', error);
      setActiveAiRequests(prev => {
        const updated = { ...prev };
        delete updated[mealId];
        return updated;
      });
    }
  };

  // Date navigation helpers
  const goToPreviousDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setCurrentDate(new Date().toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const calculateDailyTotals = () => {
    const totals = mealPlans.reduce((acc, plan) => {
      const multiplier = plan.quantity;
      acc.calories += (plan.calories_per_serving || 0) * multiplier;
      acc.protein += (plan.protein_per_serving || 0) * multiplier;
      acc.carbs += (plan.carbs_per_serving || 0) * multiplier;
      acc.fat += (plan.fat_per_serving || 0) * multiplier;
      acc.fiber += (plan.fiber_per_serving || 0) * multiplier;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    // Calculate net carbs if user tracks net carbs
    if (macroGoals && macroGoals.track_net_carbs) {
      totals.netCarbs = totals.carbs - totals.fiber;
    }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Meal Planner
        </h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setAiContext({ type: 'daily', mealId: null });
              setShowAIModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700
                     transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Daily Planner
          </button>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={goToPreviousDay}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
              title="Previous Day"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
              title="Go to Today"
            >
              Today
            </button>
            <button
              onClick={goToNextDay}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
              title="Next Day"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
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

      {/* Daily Macro Progress - Now at top */}
      {macroGoals && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Daily Macro Progress
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between mb-2 min-h-[2.5rem]">
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
              <div className="flex flex-col sm:flex-row sm:justify-between mb-2 min-h-[2.5rem]">
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
              <div className="flex flex-col sm:flex-row sm:justify-between mb-2 min-h-[2.5rem]">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {macroGoals.track_net_carbs ? 'Carbs (Net)' : 'Carbs'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {macroGoals.track_net_carbs 
                    ? `${dailyTotals.netCarbs.toFixed(1)}g / ${macroGoals.carbs}g`
                    : `${dailyTotals.carbs.toFixed(1)}g / ${macroGoals.carbs}g`
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${getProgressColor(getMacroProgress(macroGoals.track_net_carbs ? dailyTotals.netCarbs : dailyTotals.carbs, macroGoals.carbs))} h-2 rounded-full`}
                  style={{ width: `${getMacroProgress(macroGoals.track_net_carbs ? dailyTotals.netCarbs : dailyTotals.carbs, macroGoals.carbs)}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between mb-2 min-h-[2.5rem]">
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
            
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between mb-2 min-h-[2.5rem]">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fiber</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {dailyTotals.fiber.toFixed(1)}g / {macroGoals.fiber}g
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${getProgressColor(getMacroProgress(dailyTotals.fiber, macroGoals.fiber))} h-2 rounded-full`}
                  style={{ width: `${getMacroProgress(dailyTotals.fiber, macroGoals.fiber)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Food Selection Modal */}
      {showAddFood && selectedMeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Add Food to {selectedMeal?.name}
              </h3>
              
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search foods..."
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Sort Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort by:
                </label>
                <select
                  value={foodSortBy}
                  onChange={(e) => setFoodSortBy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="name">Name</option>
                  <option value="serving_size">Serving Size</option>
                  <option value="calories_per_serving">Calories</option>
                  <option value="protein_per_serving">Protein</option>
                  <option value="carbs_per_serving">Carbs</option>
                  <option value="fat_per_serving">Fat</option>
                  <option value="fiber_per_serving">Fiber</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {[
                  // Regular foods (active only)
                  ...foods.filter(food => food.active === undefined || food.active === null || food.active === 1),
                  // Linked foods mapped into pseudo-food entries with aggregated macros
                  ...linkedFoods.map(lf => {
                    const totals = (lf.components || []).reduce((acc, comp) => {
                      const q = comp.quantity || 1;
                      acc.calories += (comp.calories_per_serving || 0) * q;
                      acc.protein += (comp.protein_per_serving || 0) * q;
                      acc.carbs += (comp.carbs_per_serving || 0) * q;
                      acc.fat += (comp.fat_per_serving || 0) * q;
                      acc.fiber += (comp.fiber_per_serving || 0) * q;
                      return acc;
                    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

                    return {
                      ...lf,
                      is_linked_food: true,
                      serving_size: lf.description || 'Linked food',
                      calories_per_serving: Math.round(totals.calories),
                      protein_per_serving: Math.round(totals.protein * 10) / 10,
                      carbs_per_serving: Math.round(totals.carbs * 10) / 10,
                      fat_per_serving: Math.round(totals.fat * 10) / 10,
                      fiber_per_serving: Math.round(totals.fiber * 10) / 10,
                    };
                  })
                ]
                  .filter(food => 
                    (food.name || '').toLowerCase().includes(foodSearch.toLowerCase()) ||
                    (food.brand && food.brand.toLowerCase().includes(foodSearch.toLowerCase()))
                  )
                  .sort((a, b) => {
                    if (foodSortBy === 'name') {
                      return (a.name || '').localeCompare(b.name || '');
                    }
                    const aVal = a[foodSortBy] || 0;
                    const bVal = b[foodSortBy] || 0;
                    return bVal - aVal; // Descending order for numeric values
                  })
                  .map(food => (
                  <div key={`${food.is_linked_food ? 'linked-' : ''}${food.id}`} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{food.name}</h4>
                        {food.brand && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{food.brand}</p>
                        )}
                      </div>
                      {food.is_linked_food && (
                        <span className="text-[11px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full dark:bg-purple-900 dark:text-purple-200">
                          Linked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 space-y-1">
                      <div className="font-medium">{food.serving_size}</div>
                      <div className="grid grid-cols-2 gap-x-2">
                        <div>Cal: {food.calories_per_serving}</div>
                        <div>P: {food.protein_per_serving}g</div>
                        <div>C: {food.carbs_per_serving}g</div>
                        <div>F: {food.fat_per_serving}g</div>
                        {food.fiber_per_serving !== undefined && food.fiber_per_serving !== null && (
                          <div>Fiber: {food.fiber_per_serving}g</div>
                        )}
                      </div>
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
                          const quantity = parseFloat(e.target.previousElementSibling.value) || 1;
                          if (food.is_linked_food) {
                            handleAddLinkedFoodToMeal(food, quantity);
                          } else {
                            handleAddFoodToMeal(food.id, quantity);
                          }
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
                  onClick={() => {
                    setShowAddFood(false);
                    setFoodSearch('');
                  }}
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
            acc.fiber += (plan.fiber_per_serving || 0) * multiplier;
            return acc;
          }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

          // Calculate net carbs for meal if user tracks net carbs
          const netCarbs = mealTotals.carbs - mealTotals.fiber;

          return (
            <div key={meal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {meal.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {meal.time_start} - {meal.time_end}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {Math.round(mealTotals.calories)} cal
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      P: {mealTotals.protein.toFixed(1)}g | 
                      {macroGoals && macroGoals.track_net_carbs 
                        ? `C (Net): ${netCarbs.toFixed(1)}g`
                        : `C: ${mealTotals.carbs.toFixed(1)}g`
                      } | 
                      F: {mealTotals.fat.toFixed(1)}g | 
                      Fiber: {mealTotals.fiber.toFixed(1)}g
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
                    <button
                      onClick={() => {
                        setSelectedMeal(meal);
                        setShowAddFood(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                               transition-colors duration-200 whitespace-nowrap"
                    >
                      Add Food
                    </button>
                    
                    {/* AI Assist Dropdown */}
                    <div className="relative w-full sm:w-auto">
                      <button
                        onClick={() => setOpenAIDropdown(openAIDropdown === meal.id ? null : meal.id)}
                        className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 
                                 transition-colors duration-200 whitespace-nowrap flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Assist
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {openAIDropdown === meal.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => {
                              setAiContext({ type: 'add-item', mealId: meal.id, mode: 'single-item' });
                              setSelectedMeal(meal);
                              setTargetCalories(mealCalorieTargets[meal.id]?.toString() || '');
                              setAiPreferences('');
                              setAllowNewFoods(false);
                              setShowAIModal(true);
                              setOpenAIDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-md"
                          >
                            AI Add Item
                          </button>
                          <button
                            onClick={() => {
                              setAiContext({ type: 'plan-meal', mealId: meal.id, mode: 'meal' });
                              setSelectedMeal(meal);
                              setTargetCalories(mealCalorieTargets[meal.id]?.toString() || '');
                              setAiPreferences('');
                              setAllowNewFoods(false);
                              setShowAIModal(true);
                              setOpenAIDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-md"
                          >
                            AI Plan Meal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {mealPlansForMeal.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No foods added to this meal yet
                </p>
              ) : (
                <div className="space-y-2">
                  {mealPlansForMeal.map(plan => {
                    const netCarbs = (plan.carbs_per_serving || 0) - (plan.fiber_per_serving || 0);
                    const totalCals = Math.round((plan.calories_per_serving || 0) * plan.quantity);
                    return (
                      <div 
                        key={plan.id} 
                        draggable
                        onDragStart={() => setDraggedItem({ mealPlanId: plan.id, foodName: plan.food_name })}
                        onDragEnd={() => setDraggedItem(null)}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        {/* Desktop layout */}
                        <div className="hidden sm:flex justify-between items-center">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {plan.food_name}
                            </span>
                            <button
                              onClick={() => setEditingServings({ mealPlanId: plan.id, quantity: plan.quantity })}
                              className="text-gray-600 dark:text-gray-400 ml-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Click to edit servings"
                            >
                              {plan.quantity}x {plan.serving_size}
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {totalCals} cal
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                P: {((plan.protein_per_serving || 0) * plan.quantity).toFixed(1)}g | 
                                {macroGoals && macroGoals.track_net_carbs 
                                  ? `C (Net): ${(netCarbs * plan.quantity).toFixed(1)}g`
                                  : `C: ${((plan.carbs_per_serving || 0) * plan.quantity).toFixed(1)}g`
                                } | 
                                F: {((plan.fat_per_serving || 0) * plan.quantity).toFixed(1)}g | 
                                Fiber: {((plan.fiber_per_serving || 0) * plan.quantity).toFixed(1)}g
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveFoodFromMeal(plan.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title="Remove from meal"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Mobile layout */}
                        <div className="sm:hidden">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">
                                {plan.food_name}
                              </div>
                              <button
                                onClick={() => setEditingServings({ mealPlanId: plan.id, quantity: plan.quantity })}
                                className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                title="Click to edit servings"
                              >
                                {plan.quantity}x {plan.serving_size}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{totalCals} cal</span>
                              <button
                                onClick={() => handleRemoveFoodFromMeal(plan.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="mt-1.5 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span>P:{((plan.protein_per_serving || 0) * plan.quantity).toFixed(0)}g</span>
                            <span>C:{macroGoals && macroGoals.track_net_carbs 
                              ? (netCarbs * plan.quantity).toFixed(0) 
                              : ((plan.carbs_per_serving || 0) * plan.quantity).toFixed(0)}g</span>
                            <span>F:{((plan.fat_per_serving || 0) * plan.quantity).toFixed(0)}g</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Meal Drop Zone for Drag and Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedItem && meals.length > 1) {
                    // Allow drop only if there are multiple meals
                    handleMoveFood(draggedItem.mealPlanId, meal.id);
                  }
                }}
                className={`mt-3 p-3 border-2 border-dashed rounded-lg text-center text-xs sm:text-sm transition-colors ${
                  draggedItem 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                <span className="hidden sm:inline">
                  {draggedItem ? `Drop here to move ${draggedItem.foodName}` : 'Drag foods here to add them'}
                </span>
                <span className="sm:hidden">
                  {draggedItem ? 'Drop to move' : 'Drag here to add'}
                </span>
              </div>

                {/* AI Loading Placeholder */}
                {activeAiRequests[meal.id] && (
                  <div className={`mt-4 p-4 border-l-4 rounded-lg ${
                    activeAiRequests[meal.id].status === 'ready' 
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' 
                      : 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {activeAiRequests[meal.id].status !== 'cancelled' ? (
                          <>
                            {activeAiRequests[meal.id].status === 'ready' ? (
                              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                            )}
                            <div>
                              <p className={`font-medium ${activeAiRequests[meal.id].status === 'ready' ? 'text-yellow-900 dark:text-yellow-100' : 'text-blue-900 dark:text-blue-100'}`}>AI Assist</p>
                              <p className={`text-sm capitalize ${activeAiRequests[meal.id].status === 'ready' ? 'text-yellow-700 dark:text-yellow-300' : 'text-blue-700 dark:text-blue-300'}`}>
                                {activeAiRequests[meal.id].status === 'queued' && 'Queued...'}
                                {activeAiRequests[meal.id].status === 'contacting_ai_provider' && 'Contacting AI provider...'}
                                {activeAiRequests[meal.id].status === 'waiting_for_response' && 'Waiting for response...'}
                                {activeAiRequests[meal.id].status === 'parsing_response' && 'Parsing response...'}
                                {activeAiRequests[meal.id].status === 'ready' && 'Results ready - please review and accept'}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div>
                            <p className="font-medium text-orange-900 dark:text-orange-100">Cancelled</p>
                          </div>
                        )}
                      </div>
                      {activeAiRequests[meal.id].status !== 'ready' && activeAiRequests[meal.id].status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancelAiRequest(meal.id)}
                          className="p-1.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Cancel AI request"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Inline suggestions when ready */}
                    {activeAiRequests[meal.id].status === 'ready' && activeAiRequests[meal.id].suggestions && Array.isArray(activeAiRequests[meal.id].suggestions) && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">Suggested items:</p>
                        <div className="space-y-2">
                          {activeAiRequests[meal.id].suggestions.map((suggestion, idx) => (
                            <label key={idx} className="flex items-center p-2 bg-white dark:bg-gray-700 rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(selectedSuggestions[meal.id] || []).includes(idx)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSuggestions(prev => ({
                                      ...prev,
                                      [meal.id]: [...(prev[meal.id] || []), idx]
                                    }));
                                  } else {
                                    setSelectedSuggestions(prev => ({
                                      ...prev,
                                      [meal.id]: (prev[meal.id] || []).filter(i => i !== idx)
                                    }));
                                  }
                                }}
                                className="mr-3 rounded"
                              />
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 dark:text-white">{suggestion.name}</span>
                                <span className="text-gray-600 dark:text-gray-400 ml-2 text-sm">{suggestion.quantity}x {suggestion.serving_size}</span>
                                {suggestion.reason && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{suggestion.reason}</div>
                                )}
                              </div>
                              <div className="text-right text-sm">
                                <div className="font-medium text-gray-900 dark:text-white">{Math.round(suggestion.calories)} cal</div>
                                <div className="text-gray-600 dark:text-gray-400 text-xs">
                                  P: {suggestion.protein}g | C: {suggestion.carbs}g | F: {suggestion.fat}g | Fiber: {suggestion.fiber}g
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAddSuggestionsToMeal(meal.id)}
                          className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          Add Selected Items
                        </button>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleGetMoreSuggestions(meal.id)}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                          >
                            Get More Suggestions
                          </button>
                          <button
                            onClick={() => {
                              setActiveAiRequests(prev => {
                                const updated = { ...prev };
                                delete updated[meal.id];
                                return updated;
                              });
                              setSelectedSuggestions(prev => {
                                const updated = { ...prev };
                                delete updated[meal.id];
                                return updated;
                              });
                            }}
                            className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm"
                          >
                            Close
                          </button>
                        </div>
                        <button
                          onClick={() => setShowDebugModal(true)}
                          className="mt-2 w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-lg transition-colors text-sm"
                        >
                          View Debug Info
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          );
        })}
      </div>

      {/* AI Modal - Input Modal */}
      {showAIModal && !showAISuggestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {aiContext.mode === 'single-item' && `Add Item to ${selectedMeal?.name}`}
                {aiContext.mode === 'meal' && `Plan ${selectedMeal?.name}`}
              </h3>
              
              {(aiContext.mode === 'single-item' || aiContext.mode === 'meal') && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Calories{aiContext.mode === 'single-item' ? ' to round out' : ' for this Meal'} *
                    </label>
                    <input
                      type="number"
                      value={targetCalories}
                      onChange={(e) => setTargetCalories(e.target.value)}
                      placeholder={aiContext.mode === 'single-item' ? "E.g., 300" : "E.g., 600"}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preferences (optional)
                    </label>
                    <textarea
                      value={aiPreferences}
                      onChange={(e) => setAiPreferences(e.target.value)}
                      placeholder="E.g., vegetarian, high protein, low carb, avoid nuts, etc."
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={allowNewFoods}
                      onChange={(e) => setAllowNewFoods(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Allow suggestions not in inventory</span>
                  </label>
                </>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAIModal(false);
                    setAiPreferences('');
                    setTargetCalories('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlanMeal}
                  disabled={!targetCalories || targetCalories <= 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700
                           disabled:bg-gray-400 disabled:cursor-not-allowed
                           transition-colors duration-200"
                >
                  Generate Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Modal - Suggestions Modal */}
      {showAIModal && showAISuggestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                AI Meal Plan - {selectedMeal?.name}
              </h3>
              {aiStatus && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{aiStatus}</p>
              )}
              {aiError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">{aiError}</p>
              )}
              {(aiDebugPrompt || aiRawResponse) && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">Debug details</summary>
                  <div className="mt-2 space-y-3">
                    {aiDebugPrompt && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Prompt sent</div>
                        <textarea className="w-full h-40 text-xs p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200" value={aiDebugPrompt} readOnly />
                      </div>
                    )}
                    {aiRawResponse && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Raw AI response</div>
                        <textarea className="w-full h-40 text-xs p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200" value={aiRawResponse} readOnly />
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>

            <div className="p-6">
              {aiSuggestions.length > 0 && (
                <>
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Suggested Foods
                    </h4>
                    <div className="space-y-3">
                      {aiSuggestions.map((suggestion, index) => (
                        <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(selectedSuggestions[selectedMeal?.id] || []).includes(index)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSuggestions(prev => ({
                                    ...prev,
                                    [selectedMeal.id]: [...(prev[selectedMeal.id] || []), index]
                                  }));
                                } else {
                                  setSelectedSuggestions(prev => ({
                                    ...prev,
                                    [selectedMeal.id]: (prev[selectedMeal.id] || []).filter(i => i !== index)
                                  }));
                                }
                              }}
                              className="mt-1 w-4 h-4 rounded"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {suggestion.name}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {suggestion.quantity}x {suggestion.serving_size}
                              </div>
                              {suggestion.reason && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{suggestion.reason}</div>
                              )}
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {Math.round(suggestion.calories)} cal | P: {suggestion.protein}g | C: {suggestion.carbs}g | F: {suggestion.fat}g | Fiber: {suggestion.fiber}g
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {aiTotals && aiContext.mode !== 'single-item' && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Total Nutrition (Selected Items)
                      </h4>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Calories</span>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {Math.round(aiSuggestions
                              .filter((_, i) => (selectedSuggestions[selectedMeal?.id] || []).includes(i))
                              .reduce((sum, s) => sum + s.calories, 0))}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Protein</span>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {aiSuggestions
                              .filter((_, i) => (selectedSuggestions[selectedMeal?.id] || []).includes(i))
                              .reduce((sum, s) => sum + s.protein, 0).toFixed(1)}g
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Carbs</span>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {aiSuggestions
                              .filter((_, i) => (selectedSuggestions[selectedMeal?.id] || []).includes(i))
                              .reduce((sum, s) => sum + s.carbs, 0).toFixed(1)}g
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowAIModal(false);
                    setShowAISuggestions(false);
                    setAiSuggestions([]);
                    setSelectedSuggestions(prev => {
                      const updated = { ...prev };
                      delete updated[selectedMeal?.id];
                      return updated;
                    });
                    setTargetCalories('');
                    setAiPreferences('');
                    setAiStatus('');
                    setAiError('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSuggestionsToMeal}
                  disabled={(selectedSuggestions[selectedMeal?.id] || []).length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700
                           disabled:bg-gray-400 disabled:cursor-not-allowed
                           transition-colors duration-200"
                >
                  Add Selected to Meal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Servings Modal */}
      {editingServings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Edit Servings
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity (servings)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={editingServings.quantity}
                  onChange={(e) => setEditingServings({ ...editingServings, quantity: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Minimum: 0.5, Step: 0.5
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingServings(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateServings(editingServings.mealPlanId, editingServings.quantity)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
                           transition-colors duration-200"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Modal - Separate Small Overlay */}
      {showDebugModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Debug Information</h3>
              <button
                onClick={() => setShowDebugModal(false)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {aiDebugPrompt && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Prompt Sent to AI:</h4>
                  <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-xs text-gray-800 dark:text-gray-200 overflow-x-auto max-h-40">
                    {aiDebugPrompt}
                  </pre>
                </div>
              )}
              {aiRawResponse && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Raw Response from AI:</h4>
                  <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-xs text-gray-800 dark:text-gray-200 overflow-x-auto max-h-40">
                    {aiRawResponse}
                  </pre>
                </div>
              )}
              {!aiDebugPrompt && !aiRawResponse && (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">No debug information available yet.</p>
              )}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowDebugModal(false)}
                className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlanner;