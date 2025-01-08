import React, { useCallback, useState, useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Tab as MuiTab, TabList as MuiTabList } from '@mui/material';
import type { ThemeColors } from '../../types/theme';

// Interface for individual tab items
interface TabItem {
  label: string;
  id: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

// Props interface for the Tabs component
interface TabsProps {
  tabs: TabItem[];
  value?: number;
  onChange?: (event: React.SyntheticEvent, value: number) => void;
  defaultValue?: number;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'standard' | 'scrollable' | 'fullWidth';
  className?: string;
  autoSelect?: boolean;
  circularNavigation?: boolean;
}

// Styled container component with responsive and theme-aware styling
const TabsContainer = styled(Box, {
  shouldForwardProp: (prop) => 
    !['orientation', 'variant'].includes(prop as string),
})<{
  orientation?: 'horizontal' | 'vertical';
  variant?: 'standard' | 'scrollable' | 'fullWidth';
}>(({ theme, orientation = 'horizontal', variant = 'standard' }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: orientation === 'vertical' ? 'column' : 'row',
  position: 'relative',
  
  // Responsive styles
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    '& .MuiTabList-root': {
      flexDirection: 'row',
      overflowX: variant === 'scrollable' ? 'auto' : 'hidden',
    },
  },

  // Theme-aware colors
  '& .MuiTab-root': {
    color: (theme.palette as unknown as ThemeColors).secondaryText,
    '&.Mui-selected': {
      color: (theme.palette as unknown as ThemeColors).primary,
    },
    '&.Mui-disabled': {
      color: (theme.palette as unknown as ThemeColors).text + '40',
    },
  },

  // Accessibility focus styles
  '& .MuiTab-root:focus-visible': {
    outline: `2px solid ${(theme.palette as unknown as ThemeColors).primary}`,
    outlineOffset: '2px',
  },
}));

// Styled TabList component with enhanced accessibility
const TabList = styled(MuiTabList)(({ theme }) => ({
  borderBottom: `1px solid ${(theme.palette as unknown as ThemeColors).border}`,
  '& .MuiTabs-indicator': {
    backgroundColor: (theme.palette as unknown as ThemeColors).primary,
  },
}));

// Main Tabs component
export const Tabs: React.FC<TabsProps> = React.memo(({
  tabs,
  value: controlledValue,
  onChange,
  defaultValue = 0,
  orientation = 'horizontal',
  variant = 'standard',
  className,
  autoSelect = true,
  circularNavigation = true,
}) => {
  // State management for uncontrolled mode
  const [internalValue, setInternalValue] = useState(defaultValue);
  const tabListRef = useRef<HTMLDivElement>(null);
  
  // Determine if component is controlled
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  // Handle tab selection changes
  const handleChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    if (tabs[newValue]?.disabled) {
      return;
    }

    if (!isControlled) {
      setInternalValue(newValue);
    }

    onChange?.(event, newValue);
  }, [isControlled, onChange, tabs]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const tabCount = tabs.length;
    const currentIndex = currentValue;
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = circularNavigation
          ? (currentIndex - 1 + tabCount) % tabCount
          : Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = circularNavigation
          ? (currentIndex + 1) % tabCount
          : Math.min(tabCount - 1, currentIndex + 1);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabCount - 1;
        break;
      default:
        return;
    }

    // Skip disabled tabs
    while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
      nextIndex = circularNavigation
        ? (nextIndex + 1) % tabCount
        : Math.min(tabCount - 1, nextIndex + 1);
    }

    if (nextIndex !== currentIndex && !tabs[nextIndex]?.disabled) {
      event.preventDefault();
      if (autoSelect) {
        handleChange(event, nextIndex);
      }
      // Focus the tab
      const tabElements = tabListRef.current?.getElementsByRole('tab');
      tabElements?.[nextIndex]?.focus();
    }
  }, [tabs, currentValue, circularNavigation, autoSelect, handleChange]);

  // Effect for initial focus management
  useEffect(() => {
    if (tabListRef.current && currentValue >= 0) {
      const tabElements = tabListRef.current.getElementsByRole('tab');
      if (document.activeElement?.tagName === 'BODY') {
        tabElements[currentValue]?.focus();
      }
    }
  }, [currentValue]);

  return (
    <TabsContainer
      className={className}
      orientation={orientation}
      variant={variant}
      role="tablist"
      aria-orientation={orientation}
    >
      <TabList
        ref={tabListRef}
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        orientation={orientation}
        variant={variant}
        aria-label="Navigation tabs"
      >
        {tabs.map((tab, index) => (
          <MuiTab
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            disabled={tab.disabled}
            aria-label={tab.ariaLabel || tab.label}
            aria-selected={currentValue === index}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={currentValue === index ? 0 : -1}
          />
        ))}
      </TabList>
    </TabsContainer>
  );
});

Tabs.displayName = 'Tabs';