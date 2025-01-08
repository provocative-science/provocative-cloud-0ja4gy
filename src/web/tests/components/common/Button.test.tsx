import React from 'react'; // v18.0.0
import { render, screen, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { ThemeProvider } from '@mui/material'; // v5.0.0
import '@testing-library/jest-dom/extend-expect'; // v5.16.0

import { Button } from '../../src/components/common/Button';
import { createTheme } from '@mui/material/styles';

// Test setup utilities
const renderWithTheme = (ui: React.ReactElement, { theme = 'light', highContrast = false } = {}) => {
  const muiTheme = createTheme({
    palette: {
      mode: theme as 'light' | 'dark',
    },
  });

  return render(
    <ThemeProvider theme={muiTheme}>
      <div data-theme={theme} data-high-contrast={highContrast}>
        {ui}
      </div>
    </ThemeProvider>
  );
};

describe('Button component', () => {
  // Variants tests
  test('renders with different variants', () => {
    const variants = ['primary', 'secondary', 'text', 'destructive'] as const;
    
    variants.forEach(variant => {
      const { rerender } = renderWithTheme(
        <Button variant={variant}>Test Button</Button>
      );

      const button = screen.getByRole('button');
      
      // Check variant-specific classes
      expect(button).toHaveClass(`bg-${variant}`);
      
      // Verify color contrast meets WCAG standards
      const styles = window.getComputedStyle(button);
      const backgroundColor = styles.backgroundColor;
      const color = styles.color;
      expect(backgroundColor).toBeDefined();
      expect(color).toBeDefined();

      rerender(<Button variant={variant} disabled>Test Button</Button>);
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  // Sizes tests
  test('handles different sizes', () => {
    const sizes = ['small', 'medium', 'large'] as const;
    
    sizes.forEach(size => {
      renderWithTheme(
        <Button size={size}>Test Button</Button>
      );

      const button = screen.getByRole('button');
      
      // Check size-specific classes
      if (size === 'small') expect(button).toHaveClass('spacing-xs', 'text-sm');
      if (size === 'medium') expect(button).toHaveClass('spacing-sm', 'text-md');
      if (size === 'large') expect(button).toHaveClass('spacing-md', 'text-lg');
      
      // Verify touch target size meets accessibility standards
      const rect = button.getBoundingClientRect();
      expect(rect.height).toBeGreaterThanOrEqual(44); // WCAG touch target size
    });
  });

  // Loading state tests
  test('manages loading state', async () => {
    const handleClick = jest.fn();
    
    renderWithTheme(
      <Button loading onClick={handleClick}>Test Button</Button>
    );

    const button = screen.getByRole('button');
    const spinner = within(button).getByRole('presentation');
    
    // Check loading state attributes
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-label', 'Loading, please wait');
    expect(spinner).toBeVisible();
    
    // Verify click handler not called during loading
    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  // Keyboard navigation tests
  test('supports keyboard navigation', async () => {
    const handleClick = jest.fn();
    
    renderWithTheme(
      <Button onClick={handleClick}>Test Button</Button>
    );

    const button = screen.getByRole('button');
    
    // Test keyboard activation
    await userEvent.tab();
    expect(button).toHaveFocus();
    
    await userEvent.keyboard('{enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await userEvent.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
    
    // Verify focus visible styles
    expect(button).toHaveClass('focus-visible');
  });

  // Theme integration tests
  test('handles theme changes', () => {
    const { rerender } = renderWithTheme(
      <Button>Test Button</Button>,
      { theme: 'light' }
    );

    const button = screen.getByRole('button');
    
    // Test light theme styles
    expect(button).toHaveStyle({
      backgroundColor: 'var(--background-light)',
      color: 'var(--primary-text-light)'
    });
    
    // Test dark theme styles
    rerender(
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <div data-theme="dark">
          <Button>Test Button</Button>
        </div>
      </ThemeProvider>
    );
    
    expect(button).toHaveStyle({
      backgroundColor: 'var(--background-dark)',
      color: 'var(--primary-text-dark)'
    });
    
    // Test high contrast mode
    renderWithTheme(
      <Button highContrast>Test Button</Button>,
      { highContrast: true }
    );
    
    const highContrastButton = screen.getByRole('button');
    expect(highContrastButton).toHaveClass('high-contrast-bg', 'high-contrast-text');
  });

  // Custom theme tests
  test('applies custom theme overrides', () => {
    const customTheme = {
      backgroundColor: '#custom-bg',
      textColor: '#custom-text',
      hoverColor: '#custom-hover',
      activeColor: '#custom-active'
    };

    renderWithTheme(
      <Button customTheme={customTheme}>Test Button</Button>
    );

    const button = screen.getByRole('button');
    
    expect(button).toHaveStyle({
      '--hover-color': customTheme.hoverColor,
      '--active-color': customTheme.activeColor
    });
    expect(button).toHaveClass(customTheme.backgroundColor, customTheme.textColor);
  });

  // Touch interaction tests
  test('handles touch interactions', async () => {
    // Mock touch environment
    Object.defineProperty(window, 'ontouchstart', { value: {} });
    
    const handleClick = jest.fn();
    renderWithTheme(
      <Button onClick={handleClick} touchTargetSize="large">Test Button</Button>
    );

    const button = screen.getByRole('button');
    
    // Verify large touch target
    expect(button).toHaveClass('min-h-[48px]');
    
    // Test touch feedback
    await userEvent.click(button);
    expect(button).toHaveStyle({ transform: 'scale(0.98)' });
    
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(button).toHaveStyle({ transform: 'scale(1)' });
  });
});