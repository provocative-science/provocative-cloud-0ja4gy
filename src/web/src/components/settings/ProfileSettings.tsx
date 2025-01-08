import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import {
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Box,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material'; // ^5.0.0
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'; // ^5.0.0
import { debounce } from 'lodash'; // ^4.17.21
import { parse as parseSSHKey } from 'ssh-keygen'; // ^0.5.0
import { toast } from 'react-toastify'; // ^9.0.0

import { useAuth } from '../../hooks/useAuth';

// Interfaces
interface ProfileFormData {
  email: string;
  sshKeys: SSHKey[];
  notificationSettings: NotificationPreferences;
}

interface SSHKey {
  key: string;
  name: string;
  addedAt: Date;
  isValid: boolean;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  billingAlerts: boolean;
  securityAlerts: boolean;
}

interface ProfileSettingsProps {
  className?: string;
  onUpdateSuccess?: () => void;
  'aria-label'?: string;
  'data-testid'?: string;
}

// Constants
const SSH_KEY_MAX_LENGTH = 4096;
const SSH_KEY_NAME_MAX_LENGTH = 50;
const DEBOUNCE_DELAY = 300;

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  className,
  onUpdateSuccess,
  'aria-label': ariaLabel = 'Profile Settings Form',
  'data-testid': testId = 'profile-settings'
}) => {
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    email: user?.email || '',
    sshKeys: [],
    notificationSettings: {
      emailNotifications: true,
      billingAlerts: true,
      securityAlerts: true
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Initialize form data from user profile
  useEffect(() => {
    if (user) {
      setFormData(prevData => ({
        ...prevData,
        email: user.email
      }));
    }
  }, [user]);

  // Validate SSH key format and strength
  const validateSSHKey = useCallback(async (key: string): Promise<boolean> => {
    try {
      if (!key || key.length > SSH_KEY_MAX_LENGTH) {
        return false;
      }

      const parsedKey = await parseSSHKey(key);
      return (
        parsedKey.type === 'ed25519' &&
        parsedKey.bits >= 256 &&
        parsedKey.comment !== undefined
      );
    } catch (error) {
      console.error('SSH key validation error:', error);
      return false;
    }
  }, []);

  // Handle SSH key addition with debounced validation
  const handleSshKeyAdd = useCallback(async (key: string, name: string) => {
    try {
      setError(null);

      if (!name || name.length > SSH_KEY_NAME_MAX_LENGTH) {
        throw new Error('Invalid SSH key name');
      }

      const isValid = await validateSSHKey(key);
      if (!isValid) {
        throw new Error('Invalid ED25519 SSH key format');
      }

      // Check for duplicate keys
      const isDuplicate = formData.sshKeys.some(
        existingKey => existingKey.key === key
      );
      if (isDuplicate) {
        throw new Error('SSH key already exists');
      }

      setFormData(prevData => ({
        ...prevData,
        sshKeys: [
          ...prevData.sshKeys,
          {
            key,
            name,
            addedAt: new Date(),
            isValid: true
          }
        ]
      }));
      setIsDirty(true);
      toast.success('SSH key added successfully');
      return true;
    } catch (error) {
      setError(error.message);
      toast.error(`Failed to add SSH key: ${error.message}`);
      return false;
    }
  }, [formData, validateSSHKey]);

  // Handle SSH key removal
  const handleSshKeyRemove = useCallback((index: number) => {
    setFormData(prevData => ({
      ...prevData,
      sshKeys: prevData.sshKeys.filter((_, i) => i !== index)
    }));
    setIsDirty(true);
    toast.info('SSH key removed');
  }, []);

  // Handle notification preference changes
  const handleNotificationChange = useCallback((setting: keyof NotificationPreferences) => {
    setFormData(prevData => ({
      ...prevData,
      notificationSettings: {
        ...prevData.notificationSettings,
        [setting]: !prevData.notificationSettings[setting]
      }
    }));
    setIsDirty(true);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate CSRF token
      const csrfToken = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]'
      )?.content;
      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      // Validate all SSH keys before submission
      const invalidKeys = await Promise.all(
        formData.sshKeys.map(async key => ({
          ...key,
          isValid: await validateSSHKey(key.key)
        }))
      );

      if (invalidKeys.some(key => !key.isValid)) {
        throw new Error('One or more SSH keys are invalid');
      }

      // Submit profile update
      await updateProfile({
        ...formData,
        sshKeys: formData.sshKeys.map(key => ({
          key: key.key,
          name: key.name
        }))
      });

      setIsDirty(false);
      onUpdateSuccess?.();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error.message);
      toast.error(`Failed to update profile: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [formData, onUpdateSuccess, updateProfile, validateSSHKey]);

  // Debounced form validation
  const validateForm = debounce(() => {
    const form = formRef.current;
    if (form) {
      const isValid = form.checkValidity();
      setIsDirty(isValid);
    }
  }, DEBOUNCE_DELAY);

  return (
    <Card className={className} data-testid={testId}>
      <CardContent>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          aria-label={ariaLabel}
          noValidate
        >
          <Typography variant="h5" component="h2" gutterBottom>
            Profile Settings
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Email Address
            </Typography>
            <TextField
              fullWidth
              type="email"
              value={formData.email}
              disabled
              aria-label="Email address"
            />
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              SSH Keys
            </Typography>
            {formData.sshKeys.map((key, index) => (
              <Box
                key={`${key.name}-${index}`}
                sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
              >
                <TextField
                  fullWidth
                  value={key.name}
                  disabled
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Tooltip title="Remove SSH key">
                  <IconButton
                    onClick={() => handleSshKeyRemove(index)}
                    aria-label={`Remove SSH key ${key.name}`}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                // Open SSH key add dialog
                // Implementation would be in a separate component
              }}
              aria-label="Add new SSH key"
            >
              Add SSH Key
            </Button>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Notification Preferences
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.notificationSettings.emailNotifications}
                  onChange={() => handleNotificationChange('emailNotifications')}
                  aria-label="Toggle email notifications"
                />
              }
              label="Email Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.notificationSettings.billingAlerts}
                  onChange={() => handleNotificationChange('billingAlerts')}
                  aria-label="Toggle billing alerts"
                />
              }
              label="Billing Alerts"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.notificationSettings.securityAlerts}
                  onChange={() => handleNotificationChange('securityAlerts')}
                  aria-label="Toggle security alerts"
                />
              }
              label="Security Alerts"
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!isDirty || isLoading}
              aria-label="Save profile settings"
            >
              {isLoading ? <CircularProgress size={24} /> : 'Save Changes'}
            </Button>
          </Box>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileSettings;