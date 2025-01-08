import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.2
import { isValidEmail } from '../../utils/validation';

interface InputProps {
  id: string;
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel';
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  validate?: (value: string) => string | undefined;
  className?: string;
  min?: string;
  max?: string;
  pattern?: string;
  autoComplete?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const Input: React.FC<InputProps> = ({
  id,
  name,
  label,
  type = 'text',
  value,
  placeholder,
  required = false,
  disabled = false,
  error,
  onChange,
  onBlur,
  validate,
  className,
  min,
  max,
  pattern,
  autoComplete = true,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
}) => {
  const [localError, setLocalError] = useState<string | undefined>(error);
  const [isFocused, setIsFocused] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;
  const debounceTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalError(error);
  }, [error]);

  const validateInput = useCallback((value: string): string | undefined => {
    if (required && !value.trim()) {
      return 'This field is required';
    }

    if (value.trim()) {
      switch (type) {
        case 'email':
          if (!isValidEmail(value)) {
            return 'Please enter a valid email address';
          }
          break;
        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            return 'Please enter a valid number';
          }
          if (min && num < Number(min)) {
            return `Value must be at least ${min}`;
          }
          if (max && num > Number(max)) {
            return `Value must be at most ${max}`;
          }
          break;
        case 'date':
          if (min && value < min) {
            return `Date must be after ${new Date(min).toLocaleDateString()}`;
          }
          if (max && value > max) {
            return `Date must be before ${new Date(max).toLocaleDateString()}`;
          }
          break;
      }

      if (pattern && !new RegExp(pattern).test(value)) {
        return 'Please enter a valid format';
      }

      if (validate) {
        return validate(value);
      }
    }

    return undefined;
  }, [required, type, min, max, pattern, validate]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setIsDirty(true);

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Debounce validation for better performance
    debounceTimeout.current = setTimeout(() => {
      const validationError = validateInput(newValue);
      setLocalError(validationError);
    }, 300);

    onChange(newValue);
  }, [onChange, validateInput]);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const validationError = validateInput(event.target.value);
    setLocalError(validationError);
    onBlur?.(event);
  }, [onBlur, validateInput]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const inputClasses = classNames(
    'px-4 py-2 w-full rounded-md border transition-colors duration-200',
    'focus:outline-none focus:ring-2',
    'disabled:bg-gray-100 disabled:cursor-not-allowed',
    {
      'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20': !localError && !disabled,
      'border-red-500 focus:border-red-500 focus:ring-red-500/20': localError,
      'hover:border-gray-400': !localError && !disabled && !isFocused,
      'text-gray-500': disabled,
    },
    className
  );

  const labelClasses = classNames(
    'block text-sm font-medium mb-1 transition-colors duration-200',
    {
      'text-gray-700': !localError && !disabled,
      'text-red-500': localError,
      'text-gray-500': disabled,
    }
  );

  return (
    <div className="relative">
      <label htmlFor={id} className={labelClasses}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={inputClasses}
        min={min}
        max={max}
        pattern={pattern}
        autoComplete={autoComplete ? 'on' : 'off'}
        aria-label={ariaLabel || label}
        aria-invalid={!!localError}
        aria-required={required}
        aria-describedby={classNames(
          { [errorId]: localError },
          ariaDescribedby
        )}
      />

      {localError && isDirty && (
        <div
          id={errorId}
          className="mt-1 text-sm text-red-500 animate-fadeIn"
          role="alert"
        >
          {localError}
        </div>
      )}
    </div>
  );
};

export default Input;