import React, { useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { loadHabitsData, saveHabitsData } from '../utils/storage.js';
import { toLocalISODate, formatTime12h, getDayPart } from '../utils/dateUtils.js';

export default function HabitTracker() {
  const [habitsData, setHabitsData] = useState(() => loadHabitsData());
  const today = toLocalISODate();

  const toggleHabitToday = (habitId) => {
    const history = habitsData.history || {};
    const habitHist = history[habitId] || {};
    const current = Boolean(habitHist[today]);
    const updatedHist = {
      ...history,
      [habitId]: {
        ...habitHist,
        [today]: !current,
      },
    };
    const next = { ...habitsData, history: updatedHist };
    setHabitsData(next);
    saveHabitsData(next);
  };

  const suggestedPrompts = [
    'How do I build a habit of drinking water consistently during college hours?',
    'What is the 2-minute rule for habit building?',
    'How can I recover momentum after missing 2 days of my reading habit?',
    'Suggest a tiny habit loop for evening relaxation and sleep hygiene',
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        title="Habit Tracker & Consistency"
        description="Build sustainable daily habits. Missed days never erase your history—consistency is built over time without shame."
        suggestedPrompts={suggestedPrompts}
        actions={
          <Button variant="primary">
            + New Habit
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Tracked Habits</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px' }}>{habitsData.items.length}</div>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Completed Today</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-success)' }}>
            {habitsData.items.filter((h) => Boolean(habitsData.history?.[h.id]?.[today])).length} / {habitsData.items.length}
          </div>
        </Card>
      </div>

      {/* Habits List */}
      <Card padding="lg">
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
          ⚡ Today's Habits ({today})
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {habitsData.items.map((habit) => {
            const isDone = Boolean(habitsData.history?.[habit.id]?.[today]);
            const dayPart = habit.preferredTime ? getDayPart(habit.preferredTime) : null;
            return (
              <div
                key={habit.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isDone ? 'var(--color-success-bg)' : 'var(--color-surface)',
                  transition: 'background-color var(--transition-fast)',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <button
                    type="button"
                    onClick={() => toggleHabitToday(habit.id)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: isDone ? 'var(--color-success)' : 'var(--color-border-hover)',
                      backgroundColor: isDone ? 'var(--color-success)' : 'transparent',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 900,
                      padding: 0,
                    }}
                    title={isDone ? 'Mark habit incomplete' : 'Mark habit complete'}
                  >
                    {isDone ? '✓' : ''}
                  </button>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-base)', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {habit.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', display: 'flex', gap: 'var(--space-2)', marginTop: '2px' }}>
                      <span>{habit.frequency}</span>
                      {habit.preferredTime && <span>🕒 Prefers {formatTime12h(habit.preferredTime)}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {dayPart && <Badge type="status" value={dayPart.toLowerCase()} label={dayPart} />}
                  <Badge type="status" value={isDone ? 'completed' : 'pending'} label={isDone ? 'Done Today' : 'Pending'} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
