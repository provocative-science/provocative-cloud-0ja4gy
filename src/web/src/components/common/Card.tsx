import React, { useCallback } from 'react';
import styled from '@emotion/styled';
import { ThemeColors } from '../types/theme';

/**
 * Props interface for the Card component
 * Provides comprehensive styling and interaction options with accessibility support
 */
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: number;
  clickable?: boolean;
  onClick?: (event: React.MouseEvent | React.KeyboardEvent) => void;
  padding?: string | number;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  ariaLabel?: string;
  testId?: string;
  role?: string;
  tabIndex?: number;
}

/**
 * Styled container component for the Card
 * Implements responsive design and theme-aware styling
 */
const CardContainer = styled.div<Omit<CardProps, 'children' | 'className' | 'onClick'>>`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => typeof props.borderRadius === 'number' 
    ? `${props.borderRadius}px` 
    : props.borderRadius || '8px'};
  padding: ${props => typeof props.padding === 'number' 
    ? `${props.padding}px` 
    : props.padding || '16px'};
  width: ${props => typeof props.width === 'number' 
    ? `${props.width}px` 
    : props.width || 'auto'};
  height: ${props => typeof props.height === 'number' 
    ? `${props.height}px` 
    : props.height || 'auto'};
  box-shadow: ${props => `0 ${props.elevation || 1}px ${(props.elevation || 1) * 2}px ${props.theme.colors.shadow}`};
  transition: all 0.2s ease-in-out, background 0.3s ease-in-out;
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  position: relative;
  overflow: hidden;

  /* Interactive states */
  &:hover {
    box-shadow: ${props => props.clickable 
      ? `0 ${(props.elevation || 1) + 1}px ${((props.elevation || 1) + 1) * 2}px ${props.theme.colors.shadow}` 
      : 'inherit'};
  }

  /* Accessibility focus states */
  &:focus {
    outline: 2px solid ${props => props.theme.colors.accent};
    outline-offset: 2px;
  }

  /* Focus-visible polyfill support */
  &:focus:not(:focus-visible) {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.accent};
    outline-offset: 2px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    padding: ${props => typeof props.padding === 'number' 
      ? `${Number(props.padding) * 0.75}px` 
      : '12px'};
    border-radius: ${props => typeof props.borderRadius === 'number' 
      ? `${Number(props.borderRadius) * 0.75}px` 
      : '6px'};
  }

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid CanvasText;
    box-shadow: none;
  }
`;

/**
 * Card component providing a consistent container style across the application
 * Implements WCAG 2.1 Level AA compliance and responsive design patterns
 */
export const Card: React.FC<CardProps> = ({
  children,
  className,
  elevation = 1,
  clickable = false,
  onClick,
  padding = 16,
  width = 'auto',
  height = 'auto',
  borderRadius = 8,
  ariaLabel,
  testId,
  role = 'region',
  tabIndex,
  ...props
}) => {
  /**
   * Handles click and keyboard events for interactive cards
   */
  const handleClick = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    if (!clickable) return;

    // Handle keyboard events
    if ('key' in event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }

    onClick?.(event);
  }, [clickable, onClick]);

  /**
   * Determine appropriate ARIA attributes and role
   */
  const ariaProps = {
    role: clickable ? 'button' : role,
    'aria-label': ariaLabel,
    tabIndex: clickable ? (tabIndex ?? 0) : tabIndex,
    'data-testid': testId,
  };

  return (
    <CardContainer
      className={className}
      elevation={elevation}
      clickable={clickable}
      padding={padding}
      width={width}
      height={height}
      borderRadius={borderRadius}
      onClick={handleClick}
      onKeyDown={handleClick}
      {...ariaProps}
      {...props}
    >
      {children}
    </CardContainer>
  );
};

export default Card;