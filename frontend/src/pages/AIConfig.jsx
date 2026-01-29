import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const AIConfig = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState({
    openai_enabled: false,
    openai_api_key: '',
    openai_model: '',
    ollama_enabled: false,
    ollama_endpoint: 'http://localhost:11434',
    ollama_model: '',
    preferred_service: null
  });
  const [models, setModels] = useState({ openai: [], ollama: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/ai-config');
      setConfig(response);
      // Automatically fetch models if services are already enabled
      if (response.openai_enabled || response.ollama_enabled) {
        await fetchModels();
      }
    } catch (error) {
      console.error('Error fetching AI config:', error);
      setMessage('Failed to fetch AI configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await api.get('/ai-models');
      setModels(response);
      return response;
    } catch (error) {
      console.error('Error fetching models:', error);
      setMessage('Failed to fetch AI models');
      return null;
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.post('/ai-config', config);
      setMessage('AI configuration saved successfully');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const refreshModels = async (service) => {
    setRefreshing(service);
    setMessage('');
    try {
      const modelsResponse = await fetchModels();
      if (modelsResponse) {
        const count = service === 'openai' ? modelsResponse.openai.length : modelsResponse.ollama.length;
        setMessage(`${count} ${service} models found.`);
      }
    } catch (error) {
      setMessage(`Failed to refresh ${service} models`);
    } finally {
      setRefreshing(null);
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          AI Service Configuration
        </h1>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.includes('successful') 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* OpenAI Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              OpenAI Configuration
            </h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="openai_enabled"
                checked={config.openai_enabled}
                onChange={handleInputChange}
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable OpenAI</span>
            </label>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                name="openai_api_key"
                value={config.openai_api_key}
                onChange={handleInputChange}
                placeholder="sk-..."
                disabled={!config.openai_enabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your API key will be encrypted and stored securely
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => refreshModels('openai')}
                disabled={refreshing === 'openai' || !config.openai_enabled || !config.openai_api_key}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md 
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200"
              >
                {refreshing === 'openai' ? 'Loading Models...' : 'Load Available Models'}
              </button>
            </div>

            {models.openai.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Model
                </label>
                <select
                  name="openai_model"
                  value={config.openai_model}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select a model --</option>
                  {models.openai.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Ollama Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Ollama Configuration
            </h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="ollama_enabled"
                checked={config.ollama_enabled}
                onChange={handleInputChange}
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Ollama</span>
            </label>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Endpoint
              </label>
              <input
                type="text"
                name="ollama_endpoint"
                value={config.ollama_endpoint}
                onChange={handleInputChange}
                placeholder="http://localhost:11434"
                disabled={!config.ollama_enabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => refreshModels('ollama')}
                disabled={refreshing === 'ollama' || !config.ollama_enabled || !config.ollama_endpoint}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md 
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200"
              >
                {refreshing === 'ollama' ? 'Loading Models...' : 'Load Available Models'}
              </button>
            </div>

            {models.ollama.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Model
                </label>
                <select
                  name="ollama_model"
                  value={config.ollama_model}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select a model --</option>
                  {models.ollama.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Preferred Service Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Preferred Service
          </h2>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="preferred_service"
                value="openai"
                checked={config.preferred_service === 'openai'}
                onChange={handleInputChange}
                disabled={!config.openai_enabled}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">
                OpenAI {config.openai_enabled ? '(Available)' : '(Not configured)'}
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="preferred_service"
                value="ollama"
                checked={config.preferred_service === 'ollama'}
                onChange={handleInputChange}
                disabled={!config.ollama_enabled}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">
                Ollama {config.ollama_enabled ? '(Available)' : '(Not configured)'}
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md 
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIConfig;