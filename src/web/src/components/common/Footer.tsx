import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { ThemeMode, ThemeState } from '../../types/theme';

// Constants
const COMPANY_NAME = 'Provocative Cloud';
const CURRENT_YEAR = new Date().getFullYear();
const UPDATE_INTERVAL = 60000; // 1 minute
const METRICS_ENDPOINT = '/api/v1/environmental-metrics';

// Types
interface EnvironmentalMetrics {
  co2Captured: number;
  pue: number;
  cue: number;
  wue: number;
}

// Styled Components
const FooterContainer = styled.footer<{ theme: ThemeMode }>`
  background-color: ${({ theme }) => theme === ThemeMode.DARK ? '#1A1A1A' : '#FFFFFF'};
  color: ${({ theme }) => theme === ThemeMode.DARK ? '#FFFFFF' : '#333333'};
  padding: 2rem 1rem;
  border-top: 1px solid ${({ theme }) => theme === ThemeMode.DARK ? '#333333' : '#CCCCCC'};

  @media (min-width: 768px) {
    padding: 3rem 2rem;
  }
`;

const FooterGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  max-width: 1440px;
  margin: 0 auto;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const FooterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FooterHeading = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: inherit;
`;

const FooterList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const FooterLink = styled.a`
  color: inherit;
  text-decoration: none;
  padding: 0.5rem 0;
  display: inline-block;
  transition: color 0.2s ease;

  &:hover, &:focus {
    color: ${({ theme }) => theme === ThemeMode.DARK ? '#3399FF' : '#0066CC'};
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme === ThemeMode.DARK ? '#3399FF' : '#0066CC'};
    outline-offset: 2px;
  }
`;

const MetricsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1rem;
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const MetricValue = styled.span`
  font-size: 1.25rem;
  font-weight: 600;
`;

const Copyright = styled.div`
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid ${({ theme }) => theme === ThemeMode.DARK ? '#333333' : '#CCCCCC'};
  font-size: 0.875rem;
`;

// Main Component
const Footer: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<EnvironmentalMetrics>({
    co2Captured: 0,
    pue: 0,
    cue: 0,
    wue: 0,
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(METRICS_ENDPOINT);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch environmental metrics:', error);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <FooterContainer role="contentinfo" aria-label={t('footer.aria.label')}>
      <FooterGrid>
        <FooterSection>
          <FooterHeading>{t('footer.company')}</FooterHeading>
          <FooterList>
            <li>
              <FooterLink href="/about" aria-label={t('footer.about.aria')}>
                {t('footer.about')}
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/careers" aria-label={t('footer.careers.aria')}>
                {t('footer.careers')}
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/contact" aria-label={t('footer.contact.aria')}>
                {t('footer.contact')}
              </FooterLink>
            </li>
          </FooterList>
        </FooterSection>

        <FooterSection>
          <FooterHeading>{t('footer.resources')}</FooterHeading>
          <FooterList>
            <li>
              <FooterLink href="/docs" aria-label={t('footer.documentation.aria')}>
                {t('footer.documentation')}
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/api" aria-label={t('footer.api.aria')}>
                {t('footer.api')}
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/blog" aria-label={t('footer.blog.aria')}>
                {t('footer.blog')}
              </FooterLink>
            </li>
          </FooterList>
        </FooterSection>

        <FooterSection>
          <FooterHeading>{t('footer.legal')}</FooterHeading>
          <FooterList>
            <li>
              <FooterLink href="/privacy" aria-label={t('footer.privacy.aria')}>
                {t('footer.privacy')}
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/terms" aria-label={t('footer.terms.aria')}>
                {t('footer.terms')}
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/security" aria-label={t('footer.security.aria')}>
                {t('footer.security')}
              </FooterLink>
            </li>
          </FooterList>
        </FooterSection>

        <FooterSection>
          <FooterHeading>{t('footer.environmental.impact')}</FooterHeading>
          <MetricsContainer role="region" aria-label={t('footer.metrics.aria')}>
            <MetricItem>
              <span>{t('footer.metrics.co2')}</span>
              <MetricValue>{metrics.co2Captured.toFixed(2)} tons</MetricValue>
            </MetricItem>
            <MetricItem>
              <span>{t('footer.metrics.pue')}</span>
              <MetricValue>{metrics.pue.toFixed(2)}</MetricValue>
            </MetricItem>
            <MetricItem>
              <span>{t('footer.metrics.cue')}</span>
              <MetricValue>{metrics.cue.toFixed(2)}</MetricValue>
            </MetricItem>
            <MetricItem>
              <span>{t('footer.metrics.wue')}</span>
              <MetricValue>{metrics.wue.toFixed(2)}</MetricValue>
            </MetricItem>
          </MetricsContainer>
        </FooterSection>
      </FooterGrid>

      <Copyright>
        <p>
          © {CURRENT_YEAR} {COMPANY_NAME}. {t('footer.rights')}
        </p>
      </Copyright>
    </FooterContainer>
  );
});

Footer.displayName = 'Footer';

export default Footer;