import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useIntersectionObserver } from 'react-intersection-observer';
import { useLocale } from 'react-intl';
import { Card, CardProps } from '../common/Card';
import { GPUPricing } from '../../types/billing';
import { GPUSpecification } from '../../types/gpu';

// Props interface for the PricingCard component
export interface PricingCardProps {
  pricing: GPUPricing;
  specifications: GPUSpecification;
  onRentClick: (pricing: GPUPricing) => void;
  className?: string;
  highlighted?: boolean;
  loading?: boolean;
  error?: Error;
  testId?: string;
}

// Styled components
const PricingCardContainer = styled(Card)<{ highlighted?: boolean }>`
  width: clamp(280px, 100%, 400px);
  height: auto;
  margin: clamp(8px, 2vw, 16px);
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  position: relative;
  
  ${({ highlighted, theme }) => highlighted && `
    border: 2px solid ${theme.colors.accent};
    box-shadow: ${theme.shadows.elevated};
  `}

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.elevated};
  }

  &:focus-within {
    outline: 2px solid ${props => props.theme.colors.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion) {
    transition: none;
  }
`;

const ModelName = styled.h3`
  font-size: clamp(1.25rem, 2vw, 1.5rem);
  font-weight: 600;
  margin-bottom: 8px;
  color: ${props => props.theme.colors.primary};
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const PriceContainer = styled.div`
  display: flex;
  align-items: baseline;
  margin: 16px 0;
`;

const Price = styled.span`
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
`;

const PriceUnit = styled.span`
  font-size: 1rem;
  color: ${props => props.theme.colors.secondaryText};
  margin-left: 4px;
`;

const SpecList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0;
`;

const SpecItem = styled.li`
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  color: ${props => props.theme.colors.secondaryText};
`;

const RentButton = styled.button`
  width: 100%;
  padding: 12px;
  background-color: ${props => props.theme.colors.accent};
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => props.theme.colors.accentDark};
  }

  &:focus {
    outline: 2px solid ${props => props.theme.colors.accentLight};
    outline-offset: 2px;
  }

  &:disabled {
    background-color: ${props => props.theme.colors.disabled};
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  margin: 8px 0;
  font-size: 0.875rem;
`;

// Format price with currency symbol and locale
const formatPrice = (price: number, currency: string, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
};

export const PricingCard: React.FC<PricingCardProps> = ({
  pricing,
  specifications,
  onRentClick,
  className,
  highlighted = false,
  loading = false,
  error,
  testId
}) => {
  const { locale } = useLocale();
  const { ref, inView } = useIntersectionObserver({
    threshold: 0.1,
    triggerOnce: true
  });

  const formattedPrice = useMemo(() => {
    return formatPrice(pricing.pricePerHour, pricing.currency, locale);
  }, [pricing.pricePerHour, pricing.currency, locale]);

  const handleRentClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (!loading && !error) {
      onRentClick(pricing);
    }
  }, [loading, error, onRentClick, pricing]);

  if (loading) {
    return <PricingCardContainer as="div" className={className} data-testid={`${testId}-loading`}>
      <Card.Skeleton />
    </PricingCardContainer>;
  }

  return (
    <PricingCardContainer
      ref={ref}
      className={className}
      highlighted={highlighted}
      data-testid={testId}
      role="article"
      aria-labelledby={`model-${pricing.id}`}
    >
      <ModelName id={`model-${pricing.id}`}>{pricing.gpuModel}</ModelName>
      
      <PriceContainer>
        <Price>{formattedPrice}</Price>
        <PriceUnit>/hour</PriceUnit>
      </PriceContainer>

      <SpecList>
        <SpecItem>
          <span>VRAM</span>
          <span>{specifications.vram_gb}GB</span>
        </SpecItem>
        <SpecItem>
          <span>CUDA Cores</span>
          <span>{specifications.cuda_cores.toLocaleString()}</span>
        </SpecItem>
        <SpecItem>
          <span>Tensor Cores</span>
          <span>{specifications.tensor_cores.toLocaleString()}</span>
        </SpecItem>
        <SpecItem>
          <span>Architecture</span>
          <span>{specifications.architecture}</span>
        </SpecItem>
      </SpecList>

      {error && (
        <ErrorMessage role="alert">
          {error.message}
        </ErrorMessage>
      )}

      <RentButton
        onClick={handleRentClick}
        disabled={loading || !!error}
        aria-busy={loading}
        aria-disabled={loading || !!error}
      >
        Rent Now
      </RentButton>
    </PricingCardContainer>
  );
};

export default PricingCard;