import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { Select as MuiSelect, SelectProps, MenuItem, FormHelperText } from '@mui/material';
import { ThemeMode, ThemeColors } from '../../types/theme';

/**
 * Interface for select options with proper typing and accessibility support
 */
interface SelectOption<T> {
  label: string;
  value: T;
  disabled?: boolean;
}

/**
 * Props interface extending Material-UI SelectProps with custom accessibility features
 * and type-safe value handling
 */
export interface CustomSelectProps<T> extends Omit<SelectProps<T>, 'onChange'> {
  options: SelectOption<T>[];
  value: T | T[];
  onChange: (value: T | T[]) => void;
  multiple?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  highContrast?: boolean;
}

/**
 * Styled select component with theme integration and accessibility enhancements
 */
const StyledSelect = styled(MuiSelect)<{ theme: ThemeColors; highContrast?: boolean }>`
  // Base styles with proper contrast ratios
  background-color: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.primaryText};
  border-color: ${({ theme }) => theme.border};
  
  // High contrast mode styles
  ${({ highContrast, theme }) => highContrast && `
    border-width: 2px;
    border-color: ${theme.primaryText};
    color: ${theme.primaryText};
    background-color: ${theme.background};
    
    &:focus {
      outline: 3px solid ${theme.accent};
      outline-offset: 2px;
    }
  `}
  
  // Focus and hover states for keyboard navigation
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.accent};
    outline-offset: 1px;
  }
  
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.accent};
  }
  
  // Disabled state styles
  &:disabled {
    background-color: ${({ theme }) => theme.background};
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  // Error state styles
  &.Mui-error {
    border-color: ${({ theme }) => theme.alert};
  }
`;

/**
 * Accessible select component with theme integration and keyboard navigation
 * @template T - Type of select value
 */
export const Select = <T extends string | number>({
  options,
  value,
  onChange,
  multiple = false,
  error = false,
  helperText,
  disabled = false,
  placeholder,
  ariaLabel,
  highContrast = false,
  ...props
}: CustomSelectProps<T>): JSX.Element => {
  /**
   * Handles select value changes with type safety
   */
  const handleChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    event.preventDefault();
    const newValue = event.target.value;
    
    // Type guard for value validation
    const isValidValue = (val: unknown): val is T | T[] => {
      if (multiple) {
        return Array.isArray(val) && val.every(v => 
          options.some(opt => opt.value === v)
        );
      }
      return options.some(opt => opt.value === val);
    };

    if (isValidValue(newValue)) {
      onChange(newValue);
    }
  }, [multiple, onChange, options]);

  /**
   * Handles keyboard navigation for accessibility
   */
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // Default keyboard navigation handled by MUI
        break;
      case 'Home':
        event.preventDefault();
        const firstOption = options.find(opt => !opt.disabled);
        if (firstOption) {
          onChange(firstOption.value);
        }
        break;
      case 'End':
        event.preventDefault();
        const lastOption = [...options].reverse().find(opt => !opt.disabled);
        if (lastOption) {
          onChange(lastOption.value);
        }
        break;
    }
  }, [onChange, options]);

  /**
   * Memoized option rendering with accessibility attributes
   */
  const renderOptions = useMemo(() => 
    options.map(({ label, value: optionValue, disabled: optionDisabled }) => (
      <MenuItem
        key={optionValue.toString()}
        value={optionValue}
        disabled={optionDisabled}
        aria-disabled={optionDisabled}
        role="option"
        aria-selected={multiple ? 
          Array.isArray(value) && value.includes(optionValue) : 
          value === optionValue
        }
      >
        {label}
      </MenuItem>
    )),
    [options, value, multiple]
  );

  return (
    <div role="presentation">
      <StyledSelect
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyboardNavigation}
        multiple={multiple}
        error={error}
        disabled={disabled}
        displayEmpty
        aria-label={ariaLabel}
        aria-invalid={error}
        aria-describedby={helperText ? 'select-helper-text' : undefined}
        highContrast={highContrast}
        {...props}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            {placeholder}
          </MenuItem>
        )}
        {renderOptions}
      </StyledSelect>
      {helperText && (
        <FormHelperText
          id="select-helper-text"
          error={error}
          aria-live="polite"
        >
          {helperText}
        </FormHelperText>
      )}
    </div>
  );
};

export default Select;