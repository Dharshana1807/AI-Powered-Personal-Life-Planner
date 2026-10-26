import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Journal from '../client/src/pages/Journal.jsx';
import {
  loadJournalEntries,
  saveJournalEntries,
  JOURNAL_STORAGE_KEY,
} from '../client/src/utils/storage.js';

describe('Journal Page & Component Tests', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.window = {
      localStorage: {
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
      },
    };
  });

  it('renders initial empty state with prominent "Write Today\'s Journal" button', () => {
    const html = renderToString(React.createElement(Journal));
    expect(html).toContain("Write Today&#x27;s Journal");
    expect(html).toContain('Daily Reflection &amp; Journal');
    expect(html).toContain('No journal entries yet');
  });

  it('renders existing journal entries newest first with formatted dates', () => {
    saveJournalEntries([
      {
        id: 'j-old',
        date: '2026-10-15',
        title: 'Mid-month Checkin',
        content: 'Productive study session completed today.',
        createdAt: '2026-10-15T09:00:00Z',
        updatedAt: '2026-10-15T09:00:00Z',
      },
      {
        id: 'j-new',
        date: '2026-10-20',
        title: 'Launch Day Reflections',
        content: 'Shipped time picker and journal feature.',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
      },
    ]);

    const html = renderToString(React.createElement(Journal));
    expect(html).toContain('Launch Day Reflections');
    expect(html).toContain('Mid-month Checkin');
    expect(html).toContain('20 Oct 2026');
    expect(html).toContain('15 Oct 2026');
    expect(html).toContain('Previous Entries (2)');

    // Ensure newest date appears before older date in HTML
    const newIdx = html.indexOf('Launch Day Reflections');
    const oldIdx = html.indexOf('Mid-month Checkin');
    expect(newIdx).toBeLessThan(oldIdx);
  });
});
