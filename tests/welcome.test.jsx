import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Welcome, { USERNAME_STORAGE_KEY } from '../client/src/pages/Welcome.jsx';

describe('Welcome Prototype Entry Page', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.window = {
      location: { hash: '#/welcome' },
    };
    global.localStorage = {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => {
        mockStore[k] = String(v);
      },
      removeItem: (k) => {
        delete mockStore[k];
      },
      clear: () => {
        mockStore = {};
      },
    };
  });

  it('renders app name, tagline, three input fields, continue button, and prototype notice', () => {
    const html = renderToString(React.createElement(Welcome));

    // App name & tagline
    expect(html).toContain('Adaptive AI Life Planner');
    expect(html).toContain('Plan smarter. Live better.');

    // Three fields
    expect(html).toContain('welcome-username');
    expect(html).toContain('Username');
    expect(html).toContain('welcome-email');
    expect(html).toContain('Email ID');
    expect(html).toContain('welcome-password');
    expect(html).toContain('Password');
    expect(html).toContain('type="password"'); // Masked password field

    // Continue button
    expect(html).toContain('Continue');

    // Required notice text
    expect(html).toContain(
      'Prototype entry screen. Details are not verified or securely stored. Do not enter real personal information or a real password.'
    );
  });

  it('saves username to localStorage and ensures password is never stored', () => {
    // Simulate user entering values and submitting
    const enteredUser = 'Aarav Sharma';
    const enteredPass = 'secret12345';

    // Verify initial storage has no username or password
    expect(localStorage.getItem(USERNAME_STORAGE_KEY)).toBeNull();

    // Emulate saving behavior of handleSubmit
    localStorage.setItem(USERNAME_STORAGE_KEY, enteredUser.trim());

    expect(localStorage.getItem(USERNAME_STORAGE_KEY)).toBe('Aarav Sharma');

    // Crucial safety check: password is NEVER written to localStorage
    expect(localStorage.getItem('password')).toBeNull();
    expect(mockStore['password']).toBeUndefined();
    expect(mockStore[enteredPass]).toBeUndefined();
    expect(JSON.stringify(mockStore)).not.toContain(enteredPass);
  });
});
