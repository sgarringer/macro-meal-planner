import React, { useState } from 'react';
import api from '../services/api';

const DataExport = () => {
  const [exporting, setExporting] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });
  const [message, setMessage] = useState('');

  const handleExportMealPlans = async () => {
    setExporting('meal-plans');
    setMessage('');
    
    try {
      const params = new URLSearchParams();
      if (dateRange.start_date) params.append('start_date', dateRange.start_date);
      if (dateRange.end_date) params.append('end_date', dateRange.end_date);
      
      const response = await api.get(`/export/meal-plans/csv?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meal-plans-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage('Meal plans exported successfully!');
    } catch (error) {
      setMessage('Failed to export meal plans');
      console.error('Export error:', error);
    } finally {
      setExporting('');
    }
  };

  const handleExportFoods = async () => {
    setExporting('foods');
    setMessage('');
    
    try {
      const response = await api.get('/export/foods/csv', {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `foods-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage('Food inventory exported successfully!');
    } catch (error) {
      setMessage('Failed to export foods');
      console.error('Export error:', error);
    } finally {
      setExporting('');
    }
  };

  const handleCopyWeek = async () => {
    // Implementation for copying week functionality
    setMessage('Copy week functionality coming soon!');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 dark:text-white">Data Export & Management</h3>
      
      <div className="space-y-6">
        {/* Date Range for Meal Plans Export */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Export Date Range</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date (optional)
              </label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date (optional)
              </label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleExportMealPlans}
            disabled={exporting === 'meal-plans'}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {exporting === 'meal-plans' ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Export Meal Plans (CSV)
              </>
            )}
          </button>

          <button
            onClick={handleExportFoods}
            disabled={exporting === 'foods'}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {exporting === 'foods' ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Export Food Inventory (CSV)
              </>
            )}
          </button>
        </div>

        {/* Copy Week Functionality */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Week Management</h4>
          <button
            onClick={handleCopyWeek}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            Copy Current Week
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded-md ${message.includes('success') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
            {message}
          </div>
        )}

        {/* Export Info */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
          <h5 className="font-medium text-gray-900 dark:text-white mb-2">Export Information:</h5>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>• Meal Plans export includes all meals with nutritional data</li>
            <li>• Food Inventory export includes both common and custom foods</li>
            <li>• Date range filters apply to meal plan exports only</li>
            <li>• Exports are downloaded as CSV files for easy spreadsheet use</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataExport;