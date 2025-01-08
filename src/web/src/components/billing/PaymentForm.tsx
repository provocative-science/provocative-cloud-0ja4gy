import React, { useState, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js'; // ^1.54.0
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'; // ^1.16.0
import { debounce } from 'lodash'; // ^4.17.21
import formatCurrency from 'currency-formatter'; // ^1.5.9

import { Button } from '../common/Button';
import { createPayment } from '../../api/billing';
import { useTheme } from '../../hooks/useTheme';
import { Payment, Currency, PaymentStatus, PaymentError } from '../../types/billing';

// Initialize Stripe with public key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY!);

// Card element styles with theme support
const getCardElementStyle = (isDarkMode: boolean) => ({
  base: {
    color: isDarkMode ? '#FFFFFF' : '#333333',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '16px',
    '::placeholder': {
      color: isDarkMode ? '#CCCCCC' : '#666666',
    },
  },
  invalid: {
    color: '#FF3300',
    iconColor: '#FF3300',
  },
});

interface PaymentFormProps {
  reservationId: string;
  amount: number;
  currency: Currency;
  onSuccess: (payment: Payment) => void;
  onError: (error: PaymentError) => void;
  minAmount?: number;
  maxAmount?: number;
  className?: string;
  testId?: string;
}

const PaymentFormContent: React.FC<PaymentFormProps> = ({
  reservationId,
  amount,
  currency,
  onSuccess,
  onError,
  minAmount = 0.01,
  maxAmount = 10000,
  className,
  testId,
}) => {
  // Hooks
  const stripe = useStripe();
  const elements = useElements();
  const { theme } = useTheme();
  const formRef = useRef<HTMLFormElement>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PaymentError | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<Date | null>(null);

  // Form validation
  const validateForm = useCallback(() => {
    if (!stripe || !elements) {
      return { valid: false, error: 'Payment system not initialized' };
    }

    if (amount < minAmount || amount > maxAmount) {
      return { 
        valid: false, 
        error: `Amount must be between ${formatCurrency.format(minAmount, { code: currency })} and ${formatCurrency.format(maxAmount, { code: currency })}` 
      };
    }

    if (!cardComplete) {
      return { valid: false, error: 'Please complete card details' };
    }

    return { valid: true, error: null };
  }, [stripe, elements, amount, minAmount, maxAmount, currency, cardComplete]);

  // Handle card input changes
  const handleCardChange = debounce((event) => {
    setCardComplete(event.complete);
    if (event.error) {
      setError({
        code: 'card_error',
        message: event.error.message,
        details: event.error
      });
    } else {
      setError(null);
    }
  }, 150);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validate prerequisites
    const validation = validateForm();
    if (!validation.valid || !stripe || !elements) {
      setError({
        code: 'validation_error',
        message: validation.error || 'Invalid form state',
        details: {}
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create Stripe payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        throw stripeError;
      }

      // Create payment through our API
      const paymentResponse = await createPayment({
        reservationId,
        amount,
        currency,
        paymentMethodId: paymentMethod.id,
        metadata: {
          retryCount,
          lastAttempt: lastAttempt?.toISOString()
        }
      });

      // Handle success
      if (paymentResponse.data.status === PaymentStatus.COMPLETED) {
        onSuccess(paymentResponse.data);
        formRef.current?.reset();
        setCardComplete(false);
      } else {
        throw new Error('Payment not completed');
      }
    } catch (err) {
      const paymentError: PaymentError = {
        code: err.code || 'payment_error',
        message: err.message || 'Payment processing failed',
        details: err.details || {}
      };
      
      setError(paymentError);
      onError(paymentError);
      
      // Handle retries
      setRetryCount(prev => prev + 1);
      setLastAttempt(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setError(null);
      setLoading(false);
    };
  }, []);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={className}
      data-testid={testId}
      aria-label="Payment form"
    >
      <div className="payment-amount" aria-live="polite">
        <h3>Payment Amount</h3>
        <p className="amount">
          {formatCurrency.format(amount, { code: currency })}
        </p>
      </div>

      <div className="card-input">
        <label htmlFor="card-element">
          Credit or debit card
        </label>
        <CardElement
          id="card-element"
          options={{
            style: getCardElementStyle(theme.mode === 'dark'),
            hidePostalCode: true,
          }}
          onChange={handleCardChange}
          aria-label="Credit or debit card input"
        />
      </div>

      {error && (
        <div 
          className="error-message" 
          role="alert" 
          aria-live="assertive"
        >
          {error.message}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={!cardComplete || loading}
        loading={loading}
        fullWidth
        aria-label={loading ? 'Processing payment...' : 'Pay now'}
      >
        {loading ? 'Processing...' : 'Pay now'}
      </Button>
    </form>
  );
};

export const PaymentForm: React.FC<PaymentFormProps> = (props) => (
  <Elements stripe={stripePromise}>
    <PaymentFormContent {...props} />
  </Elements>
);

export type { PaymentFormProps };