import React, { useEffect, useCallback, memo } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

// Constants
const DEFAULT_TOAST_DURATION = 5000;
const TOAST_Z_INDEX = 9999;
const TOAST_MAX_WIDTH = '400px';
const ANIMATION_DURATION = 0.2;

// Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
  position?: ToastPosition;
  zIndex?: number;
  preserveOnRouteChange?: boolean;
}

// Styled Components
const ToastContainer = styled(motion.div)<{ position: ToastPosition; zIndex: number }>`
  position: fixed;
  z-index: ${props => props.zIndex};
  max-width: ${TOAST_MAX_WIDTH};
  margin: 8px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  ${props => {
    switch (props.position) {
      case 'top-right':
        return 'top: 0; right: 0;';
      case 'top-left':
        return 'top: 0; left: 0;';
      case 'bottom-right':
        return 'bottom: 0; right: 0;';
      case 'bottom-left':
        return 'bottom: 0; left: 0;';
    }
  }}
`;

const ToastContent = styled(motion.div)<{ type: ToastType; isDarkMode: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 4px;
  pointer-events: auto;
  box-shadow: ${props => props.isDarkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)'};
  min-height: 48px;
  gap: 8px;
  
  ${props => {
    const colors = getToastColors(props.type, props.theme);
    return `
      background-color: ${colors.background};
      color: ${colors.text};
      
      svg {
        color: ${colors.icon};
      }
    `;
  }}
`;

// Helper function to get theme-aware colors
const getToastColors = (type: ToastType, theme: ThemeState) => {
  const { mode, colors } = theme;
  const isDark = mode === 'dark';

  const baseColors = {
    success: { light: '#E6F4EA', dark: '#1E4620', text: isDark ? '#81C995' : '#1E4620', icon: '#34A853' },
    error: { light: '#FCE8E6', dark: '#5C1D18', text: isDark ? '#F28B82' : '#5C1D18', icon: '#EA4335' },
    warning: { light: '#FEF7E0', dark: '#594300', text: isDark ? '#FDD663' : '#594300', icon: '#FBBC04' },
    info: { light: '#E8F0FE', dark: '#1A3B6C', text: isDark ? '#8AB4F8' : '#1A3B6C', icon: '#4285F4' }
  };

  return {
    background: isDark ? baseColors[type].dark : baseColors[type].light,
    text: baseColors[type].text,
    icon: baseColors[type].icon
  };
};

// Toast Icons
const ToastIcon = ({ type }: { type: ToastType }) => {
  const iconProps = {
    width: 20,
    height: 20,
    'aria-hidden': true
  };

  switch (type) {
    case 'success':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      );
    case 'error':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
      );
    case 'info':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      );
  }
};

// Animation variants
const toastVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Main Component
export const Toast = memo(({
  message,
  type = 'info',
  duration = DEFAULT_TOAST_DURATION,
  onClose,
  position = 'top-right',
  zIndex = TOAST_Z_INDEX,
  preserveOnRouteChange = false
}: ToastProps) => {
  const { theme } = useTheme();
  const isDarkMode = theme.mode === 'dark';

  // Auto-dismiss timer
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  // Handle route change
  useEffect(() => {
    if (!preserveOnRouteChange) {
      return () => onClose();
    }
  }, [preserveOnRouteChange, onClose]);

  // Handle keyboard dismiss
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <AnimatePresence>
      <ToastContainer
        position={position}
        zIndex={zIndex}
        role="alert"
        aria-live="polite"
      >
        <ToastContent
          type={type}
          isDarkMode={isDarkMode}
          variants={toastVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: ANIMATION_DURATION }}
          onClick={onClose}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <ToastIcon type={type} />
          <span>{message}</span>
        </ToastContent>
      </ToastContainer>
    </AnimatePresence>
  );
});

Toast.displayName = 'Toast';

export default Toast;