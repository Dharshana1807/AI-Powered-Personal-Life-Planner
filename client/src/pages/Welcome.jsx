import React, { useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import { loadAppSettings, saveAppSettings } from '../utils/storage.js';

export const USERNAME_STORAGE_KEY = 'adaptive_planner_username';

export default function Welcome({ onContinue }) {
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(USERNAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedEmail || !trimmedPass) {
      setError('Please fill in all three fields to continue.');
      return;
    }

    try {
      // Save only the username in browser storage (never store password)
      localStorage.setItem(USERNAME_STORAGE_KEY, trimmedUser);

      // Keep settings profile display name synced
      const settings = loadAppSettings();
      saveAppSettings({
        ...settings,
        userName: trimmedUser,
      });
    } catch (err) {
      console.warn('Could not save username to localStorage:', err);
    }

    if (onContinue) {
      onContinue(trimmedUser);
    } else {
      window.location.hash = '#/dashboard';
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg, #FFFFFF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4, 16px)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
        }}
      >
        <Card
          padding="lg"
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E5E7EB)',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.05))',
          }}
        >
          {/* Header & Tagline */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6, 24px)' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--color-primary, #FFD633)',
                color: 'var(--color-text, #000000)',
                borderRadius: 'var(--radius-md, 8px)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '20px',
                marginBottom: 'var(--space-2, 8px)',
                boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0,0,0,0.05))',
              }}
            >
              AI
            </div>
            <h1
              style={{
                fontSize: 'var(--font-2xl, 24px)',
                fontWeight: 800,
                color: 'var(--color-text, #000000)',
                letterSpacing: '-0.02em',
                margin: '0 0 var(--space-1, 4px)',
              }}
            >
              Adaptive AI Life Planner
            </h1>
            <p
              style={{
                fontSize: 'var(--font-sm, 13px)',
                color: 'var(--color-muted-text, #4B5563)',
                margin: 0,
              }}
            >
              Plan smarter. Live better.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            {error && (
              <div
                style={{
                  padding: 'var(--space-2, 8px) var(--space-3, 12px)',
                  backgroundColor: 'var(--color-danger-bg, #FEF2F2)',
                  color: 'var(--color-danger-text, #991B1B)',
                  border: '1px solid var(--color-danger-border, #FECACA)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--font-xs, 12px)',
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            {/* Username Field */}
            <div>
              <label
                htmlFor="welcome-username"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-xs, 12px)',
                  fontWeight: 700,
                  color: 'var(--color-text, #000000)',
                  marginBottom: 'var(--space-1, 4px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Username
              </label>
              <input
                id="welcome-username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your name or handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg, #FFFFFF)',
                  color: 'var(--color-text, #000000)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--font-sm, 14px)',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                required
              />
            </div>

            {/* Email ID Field */}
            <div>
              <label
                htmlFor="welcome-email"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-xs, 12px)',
                  fontWeight: 700,
                  color: 'var(--color-text, #000000)',
                  marginBottom: 'var(--space-1, 4px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Email ID
              </label>
              <input
                id="welcome-email"
                name="email"
                type="text"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg, #FFFFFF)',
                  color: 'var(--color-text, #000000)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--font-sm, 14px)',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                required
              />
            </div>

            {/* Password Field (Masked input) */}
            <div>
              <label
                htmlFor="welcome-password"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-xs, 12px)',
                  fontWeight: 700,
                  color: 'var(--color-text, #000000)',
                  marginBottom: 'var(--space-1, 4px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Password
              </label>
              <input
                id="welcome-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg, #FFFFFF)',
                  color: 'var(--color-text, #000000)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--font-sm, 14px)',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                required
              />
            </div>

            {/* Continue Button */}
            <Button
              type="submit"
              variant="primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 'var(--font-base, 15px)',
                fontWeight: 800,
                marginTop: 'var(--space-2, 8px)',
              }}
            >
              Continue →
            </Button>

            {/* Mandatory Prototype Notice */}
            <p
              style={{
                fontSize: '11px',
                color: 'var(--color-muted-text, #4B5563)',
                textAlign: 'center',
                lineHeight: 1.45,
                margin: 'var(--space-1, 4px) 0 0',
                padding: '0 var(--space-2, 8px)',
              }}
            >
              Prototype entry screen. Details are not verified or securely stored. Do not enter real personal information or a real password.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
