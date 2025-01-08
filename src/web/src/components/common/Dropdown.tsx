import React, { useState, useRef, useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { Menu, MenuItem, CircularProgress, TextField } from '@mui/material';
import { KeyboardArrowDown, Search } from '@mui/icons-material';
import { ThemeColors } from '../../types/theme';
import debounce from 'lodash/debounce';

// Constants
const MENU_ITEM_HEIGHT = 48;
const MAX_MENU_ITEMS = 8;
const SEARCH_DEBOUNCE_MS = 300;

// Styled components
const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    maxHeight: MENU_ITEM_HEIGHT * MAX_MENU_ITEMS,
    width: 'auto',
    minWidth: 200,
    backgroundColor: (theme.colors as ThemeColors).background,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3],
    marginTop: 4,
  },
  '& .MuiMenuItem-root': {
    minHeight: MENU_ITEM_HEIGHT,
    padding: theme.spacing(1, 2),
    '&:hover': {
      backgroundColor: (theme.colors as ThemeColors).border,
    },
    '&.Mui-selected': {
      backgroundColor: (theme.colors as ThemeColors).accent,
      color: (theme.colors as ThemeColors).background,
      '&:hover': {
        backgroundColor: (theme.colors as ThemeColors).accent,
      },
    },
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  margin: theme.spacing(1),
  width: 'calc(100% - 16px)',
  '& .MuiInputBase-root': {
    backgroundColor: (theme.colors as ThemeColors).background,
  },
}));

// Props interface
export interface DropdownProps {
  options: Array<{ value: string; label: string }>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  multiSelect?: boolean;
  searchable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  maxHeight?: number;
  customStyles?: React.CSSProperties;
  'aria-label'?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  multiSelect = false,
  searchable = false,
  loading = false,
  disabled = false,
  error = false,
  helperText,
  maxHeight,
  customStyles,
  'aria-label': ariaLabel,
}) => {
  // State management
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // Refs
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Computed values
  const open = Boolean(anchorEl);
  const selectedLabels = Array.isArray(value)
    ? options.filter(opt => value.includes(opt.value)).map(opt => opt.label)
    : options.find(opt => opt.value === value)?.label;

  // Handlers
  const handleOpen = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      setAnchorEl(event.currentTarget);
      setFilteredOptions(options);
      setFocusedIndex(-1);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm('');
    setFocusedIndex(-1);
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  };

  const debouncedSearch = useCallback(
    debounce((term: string) => {
      const filtered = options.filter(opt =>
        opt.label.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredOptions(filtered);
    }, SEARCH_DEBOUNCE_MS),
    [options]
  );

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  };

  const handleSelect = (selectedValue: string) => {
    if (multiSelect) {
      const newValue = Array.isArray(value) ? value : [];
      const updatedValue = newValue.includes(selectedValue)
        ? newValue.filter(v => v !== selectedValue)
        : [...newValue, selectedValue];
      onChange(updatedValue);
    } else {
      onChange(selectedValue);
      handleClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        event.preventDefault();
        if (focusedIndex >= 0) {
          handleSelect(filteredOptions[focusedIndex].value);
        }
        break;
      case 'Escape':
        event.preventDefault();
        handleClose();
        break;
      default:
        break;
    }
  };

  // Effects
  useEffect(() => {
    setFilteredOptions(options);
  }, [options]);

  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open, searchable]);

  // Render
  return (
    <div
      ref={triggerRef}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel || placeholder}
      tabIndex={disabled ? -1 : 0}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...customStyles,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          border: `1px solid ${error ? '#ff0000' : '#ccc'}`,
          borderRadius: '4px',
          minHeight: '40px',
        }}
      >
        <div style={{ flex: 1 }}>
          {Array.isArray(selectedLabels)
            ? selectedLabels.join(', ') || placeholder
            : selectedLabels || placeholder}
        </div>
        {loading ? (
          <CircularProgress size={20} />
        ) : (
          <KeyboardArrowDown />
        )}
      </div>
      {helperText && (
        <div
          style={{
            color: error ? '#ff0000' : '#666',
            fontSize: '0.75rem',
            marginTop: '4px',
          }}
        >
          {helperText}
        </div>
      )}
      <StyledMenu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: maxHeight || MENU_ITEM_HEIGHT * MAX_MENU_ITEMS,
          },
        }}
        MenuListProps={{
          role: 'listbox',
          'aria-multiselectable': multiSelect,
        }}
      >
        {searchable && (
          <StyledTextField
            inputRef={searchInputRef}
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search..."
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: <Search />,
            }}
          />
        )}
        {filteredOptions.map((option, index) => (
          <MenuItem
            key={option.value}
            value={option.value}
            selected={Array.isArray(value)
              ? value.includes(option.value)
              : value === option.value}
            onClick={() => handleSelect(option.value)}
            role="option"
            aria-selected={Array.isArray(value)
              ? value.includes(option.value)
              : value === option.value}
            tabIndex={focusedIndex === index ? 0 : -1}
          >
            {option.label}
          </MenuItem>
        ))}
      </StyledMenu>
    </div>
  );
};

export default Dropdown;