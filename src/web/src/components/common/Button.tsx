import React, { memo, MouseEvent, ReactNode } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.0
import {
  text-styles,
  background-styles,
  spacing-styles,
  high-contrast-styles,
  transition-styles
} from '../../styles/theme.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'text' | 'destructive';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  highContrast?: boolean;
  customTheme?: ThemeOverride;
  confirmAction?: boolean;
  touchTargetSize?: 'default' | 'large';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

interface ThemeOverride {
  backgroundColor?: string;
  textColor?: string;
  hoverColor?: string;
  activeColor?: string;
}

const getButtonClasses = memo(({
  variant = 'primary',
  size = 'medium',
  disabled,
  className,
  highContrast,
  customTheme,
  fullWidth,
  touchTargetSize = 'default'
}: ButtonProps): string => {
  return classNames(
    'button',
    {
      // Base styles
      'bg-primary text-primary': variant === 'primary',
      'bg-secondary text-secondary': variant === 'secondary',
      'text-accent': variant === 'text',
      'bg-alert text-primary': variant === 'destructive',
      
      // Size variants
      'spacing-xs text-sm': size === 'small',
      'spacing-sm text-md': size === 'medium',
      'spacing-md text-lg': size === 'large',
      
      // States
      'opacity-50 cursor-not-allowed': disabled,
      'w-full': fullWidth,
      'min-h-[48px]': touchTargetSize === 'large',
      
      // High contrast mode
      'high-contrast-bg high-contrast-text': highContrast,
      
      // Transitions
      'transition-normal': true,
      
      // Custom theme overrides
      [customTheme?.backgroundColor || '']: !!customTheme?.backgroundColor,
      [customTheme?.textColor || '']: !!customTheme?.textColor
    },
    className
  );
});

export const Button = memo(({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  children,
  ariaLabel,
  highContrast = false,
  customTheme,
  confirmAction = false,
  touchTargetSize = 'default',
  onClick
}: ButtonProps) => {
  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    if (confirmAction) {
      const confirmed = window.confirm('Are you sure you want to proceed?');
      if (!confirmed) return;
    }

    // Handle loading state
    const button = event.currentTarget;
    if (loading) {
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-label', 'Loading, please wait');
    }

    // Add touch feedback for mobile
    if ('ontouchstart' in window) {
      button.style.transform = 'scale(0.98)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 100);
    }

    onClick?.(event);
  };

  return (
    <button
      className={getButtonClasses({
        variant,
        size,
        disabled,
        className,
        highContrast,
        customTheme,
        fullWidth,
        touchTargetSize
      })}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      role="button"
      onClick={handleClick}
      type="button"
      style={{
        ...customTheme && {
          '--hover-color': customTheme.hoverColor,
          '--active-color': customTheme.activeColor
        }
      }}
    >
      {loading ? (
        <span className="loading-spinner" aria-hidden="true">
          {/* SVG spinner icon */}
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
      ) : children}
    </button>
  );
});

Button.displayName = 'Button';

export type { ButtonProps, ThemeOverride };