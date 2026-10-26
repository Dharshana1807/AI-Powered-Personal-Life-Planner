import React, { useState, useEffect, useRef } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import Modal from '../components/common/Modal.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { loadFocusData, saveFocusData } from '../utils/storage.js';
import { toLocalISODate } from '../utils/dateUtils.js';

export default function FocusMode() {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [taskName, setTaskName] = useState('Operating Systems Revision');
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [focusData, setFocusData] = useState(() => loadFocusData());

  const timerRef = useRef(null);

  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isActive) {
      clearInterval(timerRef.current);
      setIsActive(false);
      setShowCompletionPrompt(true); // ASK user: Never auto-complete!
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, secondsRemaining]);

  const handleStart = () => {
    setIsActive(true);
  };

  const handlePause = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
  };

  const handleReset = (mins = durationMinutes) => {
    setIsActive(false);
    clearInterval(timerRef.current);
    setDurationMinutes(mins);
    setSecondsRemaining(mins * 60);
  };

  const handleResolveCompletion = (didComplete) => {
    const session = {
      id: `focus_${Date.now()}`,
      date: toLocalISODate(),
      taskName,
      durationMinutes,
      completedTask: didComplete,
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...focusData,
      sessions: [session, ...focusData.sessions],
    };
    setFocusData(updated);
    saveFocusData(updated);
    setShowCompletionPrompt(false);
    handleReset(durationMinutes);
  };

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const suggestedPrompts = [
    'How do I maintain concentration during a 45-minute deep study block?',
    'What should I do during a 5-minute Pomodoro break to rest my eyes?',
    'How can I avoid checking social media while coding?',
    'Give me a 1-minute breathing exercise to reset my focus',
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <PageHeader
        title="Deep Work & Focus Mode"
        description="Structured focus sessions without distractions. When your timer concludes, we ask if your task is done—never auto-completing."
        suggestedPrompts={suggestedPrompts}
      />

      {/* Focus Timer Display */}
      <Card padding="lg" style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-muted-text)', marginBottom: 'var(--space-2)' }}>
          Target Task: <strong style={{ color: 'var(--color-text)' }}>{taskName}</strong>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '64px',
            fontWeight: 800,
            color: isActive ? 'var(--color-text)' : 'var(--color-muted-text)',
            margin: 'var(--space-4) 0',
            letterSpacing: '2px',
          }}
        >
          {timeDisplay}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          {[15, 25, 45, 60].map((m) => (
            <button
              key={m}
              type="button"
              disabled={isActive}
              onClick={() => handleReset(m)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: durationMinutes === m ? 'var(--color-primary-hover)' : 'var(--color-border)',
                backgroundColor: durationMinutes === m ? 'var(--color-primary)' : 'var(--color-surface)',
                fontWeight: 700,
                fontSize: 'var(--font-xs)',
                cursor: isActive ? 'not-allowed' : 'pointer',
              }}
            >
              {m} mins
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
          {!isActive ? (
            <Button variant="primary" size="lg" onClick={handleStart} style={{ minWidth: '140px', fontWeight: 800 }}>
              ▶ Start Focus
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={handlePause} style={{ minWidth: '140px', fontWeight: 700 }}>
              ⏸ Pause
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={() => handleReset(durationMinutes)}>
            ↺ Reset
          </Button>
        </div>
      </Card>

      {/* Session History */}
      <Card padding="lg">
        <h2 style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: '0 0 var(--space-3)' }}>
          📜 Completed Focus Sessions ({focusData.sessions.length})
        </h2>
        {focusData.sessions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-muted-text)', fontSize: 'var(--font-sm)', padding: 'var(--space-4)' }}>
            No sessions logged today yet. Start a timer above to track your deep work.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {focusData.sessions.slice(0, 5).map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-xs)',
                }}
              >
                <div>
                  <strong>{s.taskName}</strong> ({s.durationMinutes}m) • {s.date}
                </div>
                <Badge
                  type="status"
                  value={s.completedTask ? 'completed' : 'pending'}
                  label={s.completedTask ? 'Task Completed' : 'In Progress'}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Completion Modal - Rule: ASK whether the task was completed */}
      {showCompletionPrompt && (
        <Modal
          isOpen={showCompletionPrompt}
          onClose={() => handleResolveCompletion(false)}
          title="⏱️ Focus Session Finished!"
          footer={
            <>
              <Button variant="outline" onClick={() => handleResolveCompletion(false)}>
                No, Still in Progress
              </Button>
              <Button variant="primary" onClick={() => handleResolveCompletion(true)}>
                ✓ Yes, Completed!
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text)', lineHeight: 1.5 }}>
            Great effort! You finished <strong>{durationMinutes} minutes</strong> of focused work on <strong>"{taskName}"</strong>.
            <br /><br />
            Did you finish this task, or would you like to keep working on it later?
          </p>
        </Modal>
      )}
    </div>
  );
}
