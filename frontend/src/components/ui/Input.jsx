import React, { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  icon,
  className,
  containerClassName,
  ...props
}, ref) => {
  const baseClasses = 'input w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 bg-white dark:bg-gray-800';
  
  const stateClasses = error
    ? 'border-red-500 focus:ring-red-500 text-red-900 placeholder-red-300 dark:text-red-100 dark:placeholder-red-400'
    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400';

  const classes = `${baseClasses} ${stateClasses} ${icon ? 'pl-10' : ''} ${className || ''}`;

  return (
    <div className={`space-y-1 ${containerClassName || ''}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400 dark:text-gray-500">
              {icon}
            </div>
          </div>
        )}
        
        <input
          ref={ref}
          className={classes}
          {...props}
        />
      </div>
      
      {(error || helperText) && (
        <p className={`text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;