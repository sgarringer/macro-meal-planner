import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const AIConfig = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState({
    openai_enabled: false,
    openai_api_key: '',
    ollama_enabled: false,
    ollama_endpoint: 'http://localhost:11434',
    ollama_model: '',
    preferred_service: null
  });
  const [models, setModels] = useState({ openai: [], ollama: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/ai-config');
      setConfig(response);
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
    } catch (error) {
      console.error('Error fetching models:', error);
      setMessage('Failed to fetch AI models');
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
      await fetchModels(); // Refresh models after saving
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service) => {
    setTestingConnection(service);
    try {
      const testConfig = { ...config };
      if (service === 'openai') {
        testConfig.openai_enabled = true;
      } else {
        testConfig.ollama_enabled = true;
      }

      await api.post('/ai-config', testConfig);
      const modelsResponse = await api.get('/ai-models');
      
      if (service === 'openai' && modelsResponse.openai.length > 0) {
        setMessage('OpenAI connection successful! Models found.');
      } else if (service === 'ollama' && modelsResponse.ollama.length > 0) {
        setMessage('Ollama connection successful! Models found.');
      } else {
        setMessage(`${service} connected but no models found.`);
      }
      
      setModels(modelsResponse);
    } catch (error) {
      setMessage(`${service} connection failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setTestingConnection(null);
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
        AI Service Configuration
      </h1>

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            OpenAI Configuration
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="openai_enabled"
                  checked={config.openai_enabled}
                  onChange={handleInputChange}
                  className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Enable OpenAI</span>
              </label>
              <button
                type="button"
                onClick={() => testConnection('openai')}
                disabled={testingConnection === 'openai' || !config.openai_api_key}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md 
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200"
              >
                {testingConnection === 'openai' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OpenAI API Key
              </label>
              <input
                type="password"
                name="openai_api_key"
                value={config.openai_api_key}
                onChange={handleInputChange}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your API key will be encrypted and stored securely
              </p>
            </div>

            {models.openai.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Available Models
                </label>
                <div className="space-y-2">
                  {models.openai.map(model => (
                    <div key={model.id} className="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <input
                        type="radio"
                        name="preferred_service"
                        value="openai"
                        checked={config.preferred_service === 'openai'}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {model.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ollama Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Ollama Configuration
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="ollama_enabled"
                  checked={config.ollama_enabled}
                  onChange={handleInputChange}
                  className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Enable Ollama</span>
              </label>
              <button
                type="button"
                onClick={() => testConnection('ollama')}
                disabled={testingConnection === 'ollama' || !config.ollama_endpoint}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md 
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200"
              >
                {testingConnection === 'ollama' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ollama Endpoint
              </label>
              <input
                type="text"
                name="ollama_endpoint"
                value={config.ollama_endpoint}
                onChange={handleInputChange}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {models.ollama.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Available Models
                </label>
                <div className="space-y-2">
                  {models.ollama.map(model => (
                    <div key={model.id} className="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <input
                        type="radio"
                        name="ollama_model"
                        value={model.id}
                        checked={config.ollama_model === model.id}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {model.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center">
              <input
                type="radio"
                name="preferred_service"
                value="ollama"
                checked={config.preferred_service === 'ollama'}
                onChange={handleInputChange}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">Use Ollama as preferred service</span>
            </label>
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