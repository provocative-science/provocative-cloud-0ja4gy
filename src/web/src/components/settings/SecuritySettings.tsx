import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { io, Socket } from 'socket.io-client'; // ^4.5.0
import QRCode from 'qrcode'; // ^1.5.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import { toast } from 'react-toastify'; // ^9.0.0

import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import type { AuthUser } from '../../types/auth';

// Types for component state
interface MFAStatus {
  enabled: boolean;
  secret: string | null;
  backupCodes: string[];
  verificationPending: boolean;
}

interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  lastUsed: Date;
  type: 'ed25519';
}

interface ActiveSession {
  id: string;
  device: string;
  location: string;
  lastActive: Date;
  current: boolean;
}

const SecuritySettings: React.FC = () => {
  // State management
  const [mfaStatus, setMFAStatus] = useState<MFAStatus>({
    enabled: false,
    secret: null,
    backupCodes: [],
    verificationPending: false
  });
  const [sshKeys, setSSHKeys] = useState<SSHKey[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newKeyValue, setNewKeyValue] = useState<string>('');
  const [keyPassphrase, setKeyPassphrase] = useState<string>('');

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const rateLimit = useRef<{ [key: string]: number }>({});

  // Hooks
  const { user, handleLogout } = useAuth();

  // Initialize WebSocket connection for real-time session monitoring
  useEffect(() => {
    if (!user) return;

    socketRef.current = io('/security', {
      auth: { token: localStorage.getItem('auth_token') },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current.on('session_update', (sessions: ActiveSession[]) => {
      setActiveSessions(sessions);
    });

    socketRef.current.on('security_alert', (alert: { type: string; message: string }) => {
      toast.warning(alert.message);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user]);

  // Load initial security settings
  useEffect(() => {
    if (!user) return;
    
    const loadSecuritySettings = async () => {
      try {
        const [mfaResponse, keysResponse, sessionsResponse] = await Promise.all([
          fetch('/api/v1/security/mfa'),
          fetch('/api/v1/security/ssh-keys'),
          fetch('/api/v1/security/sessions')
        ]);

        const mfa = await mfaResponse.json();
        const keys = await keysResponse.json();
        const sessions = await sessionsResponse.json();

        setMFAStatus({
          enabled: mfa.enabled,
          secret: mfa.secret,
          backupCodes: mfa.backupCodes || [],
          verificationPending: false
        });
        setSSHKeys(keys);
        setActiveSessions(sessions);
      } catch (error) {
        console.error('Failed to load security settings:', error);
        toast.error('Failed to load security settings');
      }
    };

    loadSecuritySettings();
  }, [user]);

  // MFA Management
  const handleMFAToggle = async (enable: boolean) => {
    if (!user) return;

    try {
      if (enable) {
        const response = await fetch('/api/v1/security/mfa/setup', {
          method: 'POST'
        });
        const { secret, qrCode } = await response.json();

        setMFAStatus(prev => ({
          ...prev,
          secret,
          verificationPending: true
        }));
        setQrCodeUrl(qrCode);
      } else {
        await fetch('/api/v1/security/mfa/disable', {
          method: 'POST'
        });
        setMFAStatus({
          enabled: false,
          secret: null,
          backupCodes: [],
          verificationPending: false
        });
        toast.success('2FA has been disabled');
      }
    } catch (error) {
      console.error('MFA toggle error:', error);
      toast.error('Failed to update 2FA settings');
    }
  };

  const verifyMFASetup = async () => {
    if (!mfaStatus.secret || !verificationCode) return;

    try {
      const response = await fetch('/api/v1/security/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode, secret: mfaStatus.secret })
      });

      if (!response.ok) throw new Error('Invalid verification code');

      const { backupCodes } = await response.json();
      setMFAStatus({
        enabled: true,
        secret: mfaStatus.secret,
        backupCodes,
        verificationPending: false
      });
      toast.success('2FA has been enabled successfully');
    } catch (error) {
      toast.error('Failed to verify 2FA setup');
    }
  };

  // SSH Key Management
  const handleSSHKeyAdd = async () => {
    if (!newKeyName || !newKeyValue || !keyPassphrase) return;

    try {
      // Validate ED25519 key format
      if (!newKeyValue.startsWith('ssh-ed25519')) {
        throw new Error('Only ED25519 keys are supported');
      }

      // Validate passphrase strength
      if (keyPassphrase.length < 12) {
        throw new Error('Passphrase must be at least 12 characters');
      }

      const keyFingerprint = CryptoJS.SHA256(newKeyValue).toString();
      
      const response = await fetch('/api/v1/security/ssh-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          key: newKeyValue,
          passphrase: CryptoJS.AES.encrypt(keyPassphrase, user?.id).toString(),
          fingerprint: keyFingerprint
        })
      });

      const newKey = await response.json();
      setSSHKeys(prev => [...prev, newKey]);
      toast.success('SSH key added successfully');

      // Clear form
      setNewKeyName('');
      setNewKeyValue('');
      setKeyPassphrase('');
    } catch (error) {
      console.error('SSH key add error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add SSH key');
    }
  };

  const handleSSHKeyDelete = async (keyId: string) => {
    try {
      await fetch(`/api/v1/security/ssh-keys/${keyId}`, {
        method: 'DELETE'
      });
      setSSHKeys(prev => prev.filter(key => key.id !== keyId));
      toast.success('SSH key deleted successfully');
    } catch (error) {
      console.error('SSH key delete error:', error);
      toast.error('Failed to delete SSH key');
    }
  };

  // Session Management
  const handleSessionRevoke = async (sessionId: string) => {
    try {
      await fetch(`/api/v1/security/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      setActiveSessions(prev => prev.filter(session => session.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (error) {
      console.error('Session revoke error:', error);
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await fetch('/api/v1/security/sessions', {
        method: 'DELETE'
      });
      handleLogout();
      toast.success('All sessions have been revoked');
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      toast.error('Failed to revoke all sessions');
    }
  };

  return (
    <div className="security-settings">
      {/* MFA Section */}
      <section className="mfa-section">
        <h2>Two-Factor Authentication</h2>
        {mfaStatus.verificationPending ? (
          <div className="mfa-setup">
            <img src={qrCodeUrl} alt="2FA QR Code" />
            <input
              type="text"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value)}
              placeholder="Enter verification code"
            />
            <Button onClick={verifyMFASetup}>Verify</Button>
          </div>
        ) : (
          <Button
            onClick={() => handleMFAToggle(!mfaStatus.enabled)}
            variant={mfaStatus.enabled ? 'destructive' : 'primary'}
          >
            {mfaStatus.enabled ? 'Disable 2FA' : 'Enable 2FA'}
          </Button>
        )}
      </section>

      {/* SSH Keys Section */}
      <section className="ssh-keys-section">
        <h2>SSH Keys</h2>
        <div className="ssh-keys-list">
          {sshKeys.map(key => (
            <div key={key.id} className="ssh-key-item">
              <div>
                <strong>{key.name}</strong>
                <span>{key.fingerprint}</span>
                <span>Last used: {key.lastUsed.toLocaleDateString()}</span>
              </div>
              <Button
                onClick={() => handleSSHKeyDelete(key.id)}
                variant="destructive"
                size="small"
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
        <div className="add-ssh-key">
          <input
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name"
          />
          <textarea
            value={newKeyValue}
            onChange={e => setNewKeyValue(e.target.value)}
            placeholder="ED25519 public key"
          />
          <input
            type="password"
            value={keyPassphrase}
            onChange={e => setKeyPassphrase(e.target.value)}
            placeholder="Key passphrase (min 12 characters)"
          />
          <Button onClick={handleSSHKeyAdd}>Add SSH Key</Button>
        </div>
      </section>

      {/* Active Sessions Section */}
      <section className="sessions-section">
        <h2>Active Sessions</h2>
        <div className="sessions-list">
          {activeSessions.map(session => (
            <div key={session.id} className="session-item">
              <div>
                <strong>{session.device}</strong>
                <span>{session.location}</span>
                <span>Last active: {session.lastActive.toLocaleString()}</span>
                {session.current && <span className="current-session">Current</span>}
              </div>
              {!session.current && (
                <Button
                  onClick={() => handleSessionRevoke(session.id)}
                  variant="destructive"
                  size="small"
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          onClick={handleRevokeAllSessions}
          variant="destructive"
        >
          Revoke All Sessions
        </Button>
      </section>
    </div>
  );
};

export default SecuritySettings;