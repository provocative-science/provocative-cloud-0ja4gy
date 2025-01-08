import React from 'react'; // ^18.0.0
import '../../styles/theme.css';

interface LoadingProps {
  /** Size variant of the spinner: sm (16px), md (32px), lg (48px) */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the spinner in a full-screen overlay */
  overlay?: boolean;
  /** Optional loading text to display below the spinner */
  text?: string;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

const getSpinnerSize = (size: LoadingProps['size'] = 'md') => {
  const sizes = {
    sm: { width: 16, height: 16, borderWidth: 2 },
    md: { width: 32, height: 32, borderWidth: 3 },
    lg: { width: 48, height: 48, borderWidth: 4 }
  };
  return sizes[size];
};

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  overlay = false,
  text,
  className = '',
  ariaLabel = 'Loading content'
}) => {
  const dimensions = getSpinnerSize(size);
  
  const spinnerStyle = {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    border: `${dimensions.borderWidth}px solid var(--border-light)`,
    borderTopColor: 'var(--accent-light)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    transition: 'var(--transition-normal)',
    willChange: 'transform'
  };

  const containerStyle = overlay ? {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 'var(--z-index-modal)'
  } : {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center'
  };

  const textStyle = {
    marginTop: 'var(--spacing-sm)',
    color: 'var(--primary-text-light)',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'center' as const
  };

  return (
    <div
      className={`loading-container ${className}`}
      style={containerStyle}
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="loading-spinner"
        style={spinnerStyle}
        aria-label={ariaLabel}
      />
      {text && (
        <span className="loading-text" style={textStyle}>
          {text}
        </span>
      )}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        :global([data-theme='dark']) .loading-spinner {
          border-color: var(--border-dark);
          border-top-color: var(--accent-dark);
        }

        :global([data-theme='dark']) .loading-text {
          color: var(--primary-text-dark);
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-spinner {
            animation-duration: 2s;
          }
        }
      `}</style>
    </div>
  );
};

export default Loading;