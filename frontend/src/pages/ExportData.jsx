import React from 'react';
import DataExport from '../components/DataExport';

const ExportData = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Export Data
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Export your meal plans and food inventory, or manage your weekly meal schedules.
        </p>
      </div>
      
      <DataExport />
    </div>
  );
};

export default ExportData;
