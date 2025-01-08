import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Fade from '@mui/material/Fade';
import CloseIcon from '@mui/icons-material/Close';
import { ThemeState } from '../types/theme';

// Modal size configurations with responsive widths
const MODAL_SIZES = {
  small: {
    mobile: '90vw',
    tablet: '400px',
    desktop: '480px',
  },
  medium: {
    mobile: '95vw',
    tablet: '600px',
    desktop: '720px',
  },
  large: {
    mobile: '100vw',
    tablet: '800px',
    desktop: '1024px',
  },
} as const;

// Styled components using Material-UI's styled utility
const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== 'fullScreen',
})<{ fullScreen?: boolean }>(({ theme, fullScreen }) => ({
  '& .MuiDialog-paper': {
    margin: theme.spacing(2),
    backgroundColor: (theme as unknown as ThemeState).colors.background,
    color: (theme as unknown as ThemeState).colors.primaryText,
    borderRadius: fullScreen ? 0 : theme.shape.borderRadius,
    boxShadow: theme.shadows[10],
    overflow: 'hidden',
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2),
  color: (theme as unknown as ThemeState).colors.primaryText,
  borderBottom: `1px solid ${(theme as unknown as ThemeState).colors.border}`,
  '& .MuiTypography-root': {
    fontWeight: 600,
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  color: (theme as unknown as ThemeState).colors.secondaryText,
  overflowY: 'auto',
  '&:first-of-type': {
    paddingTop: theme.spacing(3),
  },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${(theme as unknown as ThemeState).colors.border}`,
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  color: (theme as unknown as ThemeState).colors.secondaryText,
  '&:hover': {
    color: (theme as unknown as ThemeState).colors.primaryText,
  },
}));

export interface ModalProps {
  open: boolean;
  onClose: (event: {}, reason: 'backdropClick' | 'escapeKeyDown' | 'closeButtonClick') => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  disableBackdropClick?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  disableEscapeKeyDown?: boolean;
  testId?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  size = 'medium',
  fullScreen = false,
  disableBackdropClick = false,
  ariaLabel,
  ariaDescribedBy,
  disableEscapeKeyDown = false,
  testId,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Store the previously focused element when modal opens
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!open && previousFocus.current) {
      previousFocus.current.focus();
    }
  }, [open]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: {}) => {
      if (!disableBackdropClick) {
        onClose(event, 'backdropClick');
      }
    },
    [disableBackdropClick, onClose]
  );

  // Handle escape key
  const handleEscapeKeyDown = useCallback(
    (event: {}) => {
      if (!disableEscapeKeyDown) {
        onClose(event, 'escapeKeyDown');
      }
    },
    [disableEscapeKeyDown, onClose]
  );

  // Handle close button click
  const handleCloseClick = useCallback(
    (event: React.MouseEvent) => {
      onClose(event, 'closeButtonClick');
    },
    [onClose]
  );

  // Calculate modal width based on size and screen width
  const modalWidth = useMemo(() => {
    return {
      maxWidth: false,
      sx: {
        '& .MuiDialog-paper': {
          width: MODAL_SIZES[size],
          maxWidth: '100%',
          margin: fullScreen ? 0 : undefined,
        },
      },
    };
  }, [size, fullScreen]);

  return (
    <StyledDialog
      open={open}
      onClose={handleBackdropClick}
      fullScreen={fullScreen}
      aria-labelledby={ariaLabel || 'modal-title'}
      aria-describedby={ariaDescribedBy}
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 300 }}
      keepMounted={false}
      disableEscapeKeyDown={disableEscapeKeyDown}
      onKeyDown={handleEscapeKeyDown}
      {...modalWidth}
      data-testid={testId}
    >
      <StyledDialogTitle id="modal-title">
        {title}
        <CloseButton
          aria-label="close"
          onClick={handleCloseClick}
          size="large"
          edge="end"
        >
          <CloseIcon />
        </CloseButton>
      </StyledDialogTitle>
      <StyledDialogContent ref={contentRef}>
        {children}
      </StyledDialogContent>
      {actions && <StyledDialogActions>{actions}</StyledDialogActions>}
    </StyledDialog>
  );
};

export default Modal;