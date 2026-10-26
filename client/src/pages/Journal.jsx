import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import Modal from '../components/common/Modal.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import DatePicker from '../components/common/DatePicker.jsx';
import {
  loadJournalEntries,
  saveJournalEntries,
  deleteJournalEntry,
} from '../utils/storage.js';
import { formatDisplayDate, toLocalISODate } from '../utils/dateUtils.js';

export default function Journal() {
  const [entries, setEntries] = useState(() => loadJournalEntries());
  // activeView: 'list' | 'write' | 'view'
  const [activeView, setActiveView] = useState('list');

  // Editor state
  const [editingId, setEditingId] = useState(null);
  const [entryDate, setEntryDate] = useState(() => toLocalISODate());
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [editorError, setEditorError] = useState(null);

  // Viewing state
  const [viewingEntry, setViewingEntry] = useState(null);

  // Modals state
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [collisionEntry, setCollisionEntry] = useState(null);
  const [pendingDateChange, setPendingDateChange] = useState(null);

  // Reload entries on mount to ensure fresh state
  useEffect(() => {
    setEntries(loadJournalEntries());
  }, []);

  // Handlers for "Write Today's Journal"
  const handleStartTodayJournal = () => {
    const today = toLocalISODate();
    const existing = entries.find((e) => e.date === today);

    if (existing) {
      setCollisionEntry(existing);
      return;
    }

    setEditingId(null);
    setEntryDate(today);
    setEntryTitle('');
    setEntryContent('');
    setEditorError(null);
    setActiveView('write');
  };

  // Start new journal entry with custom date
  const handleStartNewJournal = (customDate = toLocalISODate()) => {
    const existing = entries.find((e) => e.date === customDate);
    if (existing) {
      setCollisionEntry(existing);
      return;
    }

    setEditingId(null);
    setEntryDate(customDate);
    setEntryTitle('');
    setEntryContent('');
    setEditorError(null);
    setActiveView('write');
  };

  // Open entry for editing
  const handleEditEntry = (entry) => {
    setEditingId(entry.id);
    setEntryDate(entry.date);
    setEntryTitle(entry.title || '');
    setEntryContent(entry.content || '');
    setEditorError(null);
    setActiveView('write');
  };

  // Read / View entry
  const handleViewEntry = (entry) => {
    setViewingEntry(entry);
    setActiveView('view');
  };

  // Handle date change inside the editor
  const handleEditorDateChange = (newDate) => {
    if (!newDate || newDate === entryDate) return;

    // Check collision with another saved entry
    const existing = entries.find((e) => e.date === newDate && e.id !== editingId);
    if (existing) {
      setPendingDateChange(newDate);
      setCollisionEntry(existing);
      return;
    }

    setEntryDate(newDate);
  };

  // Save entry handler
  const handleSaveEntry = (e) => {
    if (e) e.preventDefault();

    if (!entryTitle.trim()) {
      setEditorError('Please provide a title for your journal entry.');
      return;
    }
    if (!entryContent.trim()) {
      setEditorError('Please write your reflections in the journal content area.');
      return;
    }

    // Safety collision check: ensure no other entry has this date
    const collision = entries.find((en) => en.date === entryDate && en.id !== editingId);
    if (collision) {
      setCollisionEntry(collision);
      return;
    }

    const now = new Date().toISOString();
    let updatedList;
    let savedEntry;

    if (editingId) {
      // Update existing
      updatedList = entries.map((en) => {
        if (en.id === editingId) {
          savedEntry = {
            ...en,
            date: entryDate,
            title: entryTitle.trim(),
            content: entryContent.trim(),
            updatedAt: now,
          };
          return savedEntry;
        }
        return en;
      });
    } else {
      // Create new entry
      savedEntry = {
        id: `journal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: entryDate,
        title: entryTitle.trim(),
        content: entryContent.trim(),
        createdAt: now,
        updatedAt: now,
      };
      updatedList = [savedEntry, ...entries];
    }

    const saveResult = saveJournalEntries(updatedList);
    if (!saveResult.success) {
      setEditorError(saveResult.error || 'Failed to save journal entry.');
      return;
    }

    const fresh = loadJournalEntries();
    setEntries(fresh);
    setViewingEntry(savedEntry);
    setActiveView('view');
  };

  // Delete entry confirmation
  const handleConfirmDelete = () => {
    if (!entryToDelete) return;
    deleteJournalEntry(entryToDelete.id);
    const fresh = loadJournalEntries();
    setEntries(fresh);
    if (viewingEntry && viewingEntry.id === entryToDelete.id) {
      setViewingEntry(null);
      setActiveView('list');
    }
    setEntryToDelete(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--font-3xl)',
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Daily Reflection & Journal
          </h1>
          <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted-text)', marginTop: 'var(--space-1)' }}>
            Record personal reflections, milestones, and energy levels. Private to your local browser storage.
          </p>
        </div>

        {activeView === 'list' && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button
              id="write-today-journal-btn"
              variant="primary"
              size="lg"
              onClick={handleStartTodayJournal}
              style={{
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontWeight: 700,
              }}
            >
              ✍️ Write Today's Journal
            </Button>
          </div>
        )}
      </div>

      {/* VIEW: Read Single Entry */}
      {activeView === 'view' && viewingEntry && (
        <Card padding="lg" highlight="yellow">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <span
                  style={{
                    backgroundColor: 'var(--color-primary-subtle)',
                    border: '1px solid var(--color-primary-hover)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 10px',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                  }}
                >
                  📅 {formatDisplayDate(viewingEntry.date)}
                </span>
                {viewingEntry.updatedAt && viewingEntry.updatedAt !== viewingEntry.createdAt && (
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-subtle-text)' }}>
                    (Edited)
                  </span>
                )}
              </div>
              <h2
                style={{
                  fontSize: 'var(--font-2xl)',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                {viewingEntry.title}
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveView('list')}
              >
                ← All Entries
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleEditEntry(viewingEntry)}
              >
                ✏️ Edit Entry
              </Button>
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                onClick={() => setEntryToDelete(viewingEntry)}
              >
                🗑️ Delete
              </Button>
            </div>
          </div>

          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.75,
              fontSize: 'var(--font-base)',
              color: 'var(--color-text)',
              minHeight: '160px',
              padding: 'var(--space-2) 0',
            }}
          >
            {viewingEntry.content}
          </div>
        </Card>
      )}

      {/* VIEW: Write / Edit Entry */}
      {activeView === 'write' && (
        <Card padding="lg" highlight="yellow">
          <form onSubmit={handleSaveEntry}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: 'var(--space-4)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div>
                <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  {editingId ? 'Edit Journal Entry' : 'New Journal Entry'}
                </h2>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
                  {editingId ? 'Update your reflections for this date.' : 'Express your thoughts, lessons, and highlights.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setEditorError(null);
                    setActiveView(viewingEntry ? 'view' : 'list');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  id="save-journal-entry-btn"
                  variant="primary"
                  size="sm"
                  type="submit"
                  style={{ fontWeight: 700 }}
                >
                  💾 Save Entry
                </Button>
              </div>
            </div>

            {editorError && (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {editorError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Journal Date using DatePicker */}
              <div style={{ maxWidth: '280px' }}>
                <DatePicker
                  id="journal-date-picker"
                  label="Journal Date"
                  value={entryDate}
                  onChange={handleEditorDateChange}
                  required={true}
                />
              </div>

              {/* Title Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label
                  htmlFor="journal-title-field"
                  style={{
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}
                >
                  Title <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="journal-title-field"
                  type="text"
                  required
                  placeholder="e.g. Focus on deep work and afternoon recovery"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-border-focus)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              {/* Writing Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label
                  htmlFor="journal-content-field"
                  style={{
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}
                >
                  Reflections & Thoughts <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  id="journal-content-field"
                  required
                  rows={12}
                  placeholder="How did your schedule go today? What went well? What obstacles did you encounter? What are you grateful for?"
                  value={entryContent}
                  onChange={(e) => setEntryContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '260px',
                    padding: 'var(--space-4)',
                    fontSize: 'var(--font-base)',
                    lineHeight: 1.65,
                    fontFamily: 'var(--font-sans)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-border-focus)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setEditorError(null);
                    setActiveView(viewingEntry ? 'view' : 'list');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  style={{ fontWeight: 700 }}
                >
                  💾 Save Entry
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* VIEW: List of Previous Entries */}
      {activeView === 'list' && (
        <div>
          {entries.length === 0 ? (
            <Card padding="lg" highlight="orange">
              <EmptyState
                icon="📝"
                title="No journal entries yet"
                description="Capture reflections on schedule adherence, daily wins, energy levels, and personal insights. Start your streak today!"
                action={
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleStartTodayJournal}
                    style={{ fontWeight: 700 }}
                  >
                    ✍️ Write Today's Journal
                  </Button>
                }
              />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 'var(--space-2)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  {`Previous Entries (${entries.length})`}
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStartNewJournal(toLocalISODate())}
                >
                  + New Date Entry
                </Button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 'var(--space-4)',
                }}
              >
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'var(--color-surface)',
                      padding: 'var(--space-5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 'var(--space-4)',
                      transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 'var(--font-xs)',
                            fontWeight: 700,
                            padding: '2px 8px',
                            backgroundColor: 'var(--color-primary-subtle)',
                            border: '1px solid var(--color-primary-hover)',
                            borderRadius: 'var(--radius-full)',
                            color: 'var(--color-text)',
                          }}
                        >
                          📅 {formatDisplayDate(entry.date)}
                        </span>
                        {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-subtle-text)' }}>
                            Edited
                          </span>
                        )}
                      </div>

                      <h3
                        style={{
                          fontSize: 'var(--font-md)',
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          margin: '0 0 var(--space-2)',
                          lineHeight: 1.3,
                        }}
                      >
                        {entry.title || 'Untitled Entry'}
                      </h3>

                      <p
                        style={{
                          fontSize: 'var(--font-sm)',
                          color: 'var(--color-muted-text)',
                          margin: 0,
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {entry.content}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 'var(--space-3)',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleViewEntry(entry)}
                      >
                        📖 Read
                      </Button>

                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEntry(entry)}
                        >
                          ✏️ Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                          onClick={() => setEntryToDelete(entry)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {entryToDelete && (
        <Modal
          isOpen={Boolean(entryToDelete)}
          onClose={() => setEntryToDelete(null)}
          title="Delete Journal Entry"
          maxWidth="460px"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setEntryToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                style={{
                  backgroundColor: 'var(--color-danger)',
                  color: '#FFFFFF',
                  borderColor: 'var(--color-danger)',
                }}
                onClick={handleConfirmDelete}
              >
                Yes, Delete Entry
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-base)', color: 'var(--color-text)', lineHeight: 1.5 }}>
              Are you sure you want to delete the journal entry for{' '}
              <strong>{formatDisplayDate(entryToDelete.date)}</strong>?
            </p>
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontStyle: 'italic',
                fontSize: 'var(--font-sm)',
                color: 'var(--color-muted-text)',
              }}
            >
              "{entryToDelete.title}"
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-danger)' }}>
              This action cannot be undone. The entry will be permanently removed from your browser storage.
            </p>
          </div>
        </Modal>
      )}

      {/* MODAL: Duplicate Date Collision Warning */}
      {collisionEntry && (
        <Modal
          isOpen={Boolean(collisionEntry)}
          onClose={() => {
            setCollisionEntry(null);
            setPendingDateChange(null);
          }}
          title="Journal Entry Already Exists"
          maxWidth="500px"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setCollisionEntry(null);
                  setPendingDateChange(null);
                }}
              >
                Choose Another Date
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const target = collisionEntry;
                  setCollisionEntry(null);
                  setPendingDateChange(null);
                  handleEditEntry(target);
                }}
              >
                Open & Edit Existing Entry
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-base)', color: 'var(--color-text)', lineHeight: 1.5 }}>
              A journal entry already exists for <strong>{formatDisplayDate(collisionEntry.date)}</strong>:
            </p>
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              <strong style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
                {collisionEntry.title}
              </strong>
              <div
                style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-muted-text)',
                  marginTop: 'var(--space-1)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {collisionEntry.content}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-subtle-text)' }}>
              To protect your reflections, entries are never silently overwritten. Would you like to open and edit this existing entry?
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
