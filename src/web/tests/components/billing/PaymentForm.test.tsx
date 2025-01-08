import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { jest } from '@jest/globals';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PaymentForm } from '../../src/components/billing/PaymentForm';
import { createPayment } from '../../src/api/billing';
import { PaymentStatus, Currency } from '../../src/types/billing';

// Mock Stripe hooks and components
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  CardElement: () => <div data-testid="stripe-card" />,
  useStripe: jest.fn(),
  useElements: jest.fn(),
}));

// Mock billing API
jest.mock('../../src/api/billing', () => ({
  createPayment: jest.fn(),
}));

describe('PaymentForm Component', () => {
  // Default test props
  const defaultProps = {
    reservationId: 'test-reservation-123',
    amount: 450.0,
    currency: Currency.USD,
    onSuccess: jest.fn(),
    onError: jest.fn(),
    testId: 'payment-form',
  };

  // Mock implementations
  const mockStripe = {
    createPaymentMethod: jest.fn(),
  };

  const mockElements = {
    getElement: jest.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Stripe hook mocks
    (useStripe as jest.Mock).mockReturnValue(mockStripe);
    (useElements as jest.Mock).mockReturnValue(mockElements);

    // Setup default successful responses
    mockStripe.createPaymentMethod.mockResolvedValue({
      paymentMethod: { id: 'pm_test123' },
    });

    mockElements.getElement.mockReturnValue({});

    (createPayment as jest.Mock).mockResolvedValue({
      data: {
        id: 'test-payment-123',
        status: PaymentStatus.COMPLETED,
        amount: 450.0,
        currency: Currency.USD,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders payment form with correct elements', () => {
    render(<PaymentForm {...defaultProps} />);

    // Verify form elements
    expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    expect(screen.getByText('Payment Amount')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
    expect(screen.getByText('Credit or debit card')).toBeInTheDocument();
    expect(screen.getByTestId('stripe-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
  });

  it('handles successful payment submission', async () => {
    render(<PaymentForm {...defaultProps} />);

    // Mock card completion
    fireEvent.change(screen.getByTestId('stripe-card'), {
      complete: true,
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));

    await waitFor(() => {
      // Verify Stripe payment method creation
      expect(mockStripe.createPaymentMethod).toHaveBeenCalledWith({
        type: 'card',
        card: expect.any(Object),
      });

      // Verify payment API call
      expect(createPayment).toHaveBeenCalledWith({
        reservationId: defaultProps.reservationId,
        amount: defaultProps.amount,
        currency: defaultProps.currency,
        paymentMethodId: 'pm_test123',
        metadata: expect.any(Object),
      });

      // Verify success callback
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-payment-123',
        status: PaymentStatus.COMPLETED,
      }));
    });
  });

  it('displays form validation errors', async () => {
    render(<PaymentForm {...defaultProps} />);

    // Submit form without completing card details
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please complete card details');
    });

    // Verify accessibility
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('handles Stripe errors correctly', async () => {
    // Mock Stripe error
    mockStripe.createPaymentMethod.mockRejectedValue({
      type: 'card_error',
      message: 'Your card was declined',
    });

    render(<PaymentForm {...defaultProps} />);

    // Complete card details and submit
    fireEvent.change(screen.getByTestId('stripe-card'), {
      complete: true,
    });
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Your card was declined');
      expect(defaultProps.onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'card_error',
        message: 'Your card was declined',
      }));
    });
  });

  it('manages loading state during submission', async () => {
    render(<PaymentForm {...defaultProps} />);

    // Complete card details
    fireEvent.change(screen.getByTestId('stripe-card'), {
      complete: true,
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));

    // Verify loading state
    expect(screen.getByRole('button')).toHaveAttribute('disabled');
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Processing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
      expect(screen.getByText('Pay now')).toBeInTheDocument();
    });
  });

  it('validates amount against minimum and maximum limits', async () => {
    const invalidProps = {
      ...defaultProps,
      amount: 0.001, // Below minimum
    };

    render(<PaymentForm {...invalidProps} />);

    fireEvent.change(screen.getByTestId('stripe-card'), {
      complete: true,
    });
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/amount must be between/i);
    });
  });

  it('maintains accessibility during state changes', async () => {
    render(<PaymentForm {...defaultProps} />);

    // Verify initial accessibility
    expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Payment form');
    expect(screen.getByTestId('stripe-card')).toHaveAttribute('aria-label', 'Credit or debit card input');

    // Submit and verify loading state accessibility
    fireEvent.change(screen.getByTestId('stripe-card'), {
      complete: true,
    });
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Processing payment...');

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Pay now');
    });
  });
});