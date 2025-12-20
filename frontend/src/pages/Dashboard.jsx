import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import Button from '../components/ui/Button';
import DataExport from '../components/DataExport';

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Set mock profile data
    setProfile({
      macro_protein_g: 150,
      macro_carbs_g: 200,
      macro_fat_g: 65,
      macro_calories: 2000
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome back, {user?.username}! 👋
        </p>
        <DataExport />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Calories</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">0</p>
        <DataExport />
          </div>
        <DataExport />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Protein</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">0g</p>
        <DataExport />
          </div>
        <DataExport />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Carbs</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">0g</p>
        <DataExport />
          </div>
        <DataExport />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Fat</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">0g</p>
        <DataExport />
          </div>
        <DataExport />
        </div>
        <DataExport />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Get started with these common actions:
            </p>
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium">Set up your macro goals</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Go to Profile to configure your nutritional targets
                </p>
        <DataExport />
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium">Add foods to your catalog</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Build your personal food database in Foods section
                </p>
        <DataExport />
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium">Plan your meals</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Start planning your weekly meals in Meal Planning
                </p>
        <DataExport />
              </div>
        <DataExport />
            </div>
        <DataExport />
          </div>
        <DataExport />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Your Macro Goals
          </h2>
          {profile ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Daily Calories</span>
                <span className="font-medium">{profile.macro_calories} kcal</span>
        <DataExport />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Protein</span>
                <span className="font-medium text-green-600">{profile.macro_protein_g}g</span>
        <DataExport />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Carbs</span>
                <span className="font-medium text-yellow-600">{profile.macro_carbs_g}g</span>
        <DataExport />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Fat</span>
                <span className="font-medium text-red-600">{profile.macro_fat_g}g</span>
        <DataExport />
              </div>
        <DataExport />
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">Loading your profile...</p>
          )}
        <DataExport />
        </div>
        <DataExport />
      </div>
        <DataExport />
    </div>
  );
};

export default Dashboard;