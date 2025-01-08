import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { ThemeColors, ThemeMode } from '../../types/theme';

// Interface for Alert component props
interface AlertProps {
  children: React.ReactNode;
  severity?: 'error' | 'warning' | 'info' | 'success';
  variant?: 'filled' | 'outlined';
  onClose?: () => void;
  className?: string;
  dismissible?: boolean;
  role?: 'alert' | 'status';
  dir?: 'ltr' | 'rtl';
  disableAnimation?: boolean;
}

// Styled container for the alert with theme support
const AlertContainer = styled.div<{
  severity: AlertProps['severity'];
  variant: AlertProps['variant'];
  dir: AlertProps['dir'];
  isExiting: boolean;
}>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 4px;
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.5;
  position: relative;
  direction: ${props => props.dir};
  min-width: 200px;
  max-width: 800px;
  opacity: ${props => props.isExiting ? 0 : 1};
  transition: ${props => props.disableAnimation ? 'none' : 'opacity 0.2s ease-in-out'};

  ${props => {
    const getColor = (severity: AlertProps['severity']) => {
      switch (severity) {
        case 'error':
          return props.theme.colors.alert;
        case 'success':
          return props.theme.colors.success;
        case 'warning':
          return props.theme.colors.warning;
        case 'info':
        default:
          return props.theme.colors.info;
      }
    };

    const color = getColor(props.severity);
    
    return props.variant === 'outlined' 
      ? `
        border: 1px solid ${color};
        background-color: transparent;
        color: ${color};
      `
      : `
        background-color: ${color};
        color: ${props.theme.colors.background};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      `;
  }}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Styled close button with accessibility features
const CloseButton = styled.button`
  position: absolute;
  ${props => props.dir === 'rtl' ? 'left: 8px' : 'right: 8px'};
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s ease, background-color 0.2s ease;

  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }

  &:focus {
    outline: 2px solid currentColor;
    outline-offset: 2px;
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Close icon SVG component
const CloseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 4L4 12M4 4L12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Alert: React.FC<AlertProps> = ({
  children,
  severity = 'info',
  variant = 'filled',
  onClose,
  className,
  dismissible = false,
  role = 'alert',
  dir = 'ltr',
  disableAnimation = false,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef<number>();

  const handleClose = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disableAnimation) {
      onClose?.();
      return;
    }

    setIsExiting(true);
    timeoutRef.current = window.setTimeout(() => {
      onClose?.();
    }, 200);
  }, [onClose, disableAnimation]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <AlertContainer
      role={role}
      severity={severity}
      variant={variant}
      dir={dir}
      className={className}
      isExiting={isExiting}
      disableAnimation={disableAnimation}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
    >
      {children}
      {(dismissible || onClose) && (
        <CloseButton
          onClick={handleClose}
          aria-label="Close alert"
          dir={dir}
          type="button"
        >
          <CloseIcon />
        </CloseButton>
      )}
    </AlertContainer>
  );
};

export default Alert;