import React, { useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { loadFitnessData, saveFitnessData } from '../utils/storage.js';

export default function FitnessPlanner() {
  const [fitnessData, setFitnessData] = useState(() => loadFitnessData());

  const suggestedPrompts = [
    'Give me a 20-minute bodyweight mobility routine for desk posture',
    'How should I structure a 4-day beginner workout plan without equipment?',
    'I feel sore today, suggest active recovery and light stretches',
    'How much rest between sets for endurance vs strength?',
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        title="Fitness & Movement Planner"
        description="Daily workouts, bodyweight exercise routines, and active recovery. (General wellness guidance, not medical advice)."
        suggestedPrompts={suggestedPrompts}
        actions={
          <Button variant="outline" onClick={() => (window.location.hash = '#/assistant?prompt=Recommend%20a%20bodyweight%20workout%20routine')}>
            💪 Ask Fitness Assistant
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Active Plans</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px' }}>{fitnessData.plans.length}</div>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Workouts Completed</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-success)' }}>
            {fitnessData.logs.filter((l) => l.completed).length}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Workout Routines */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            🏋️ Current Workout Routines
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {fitnessData.plans.map((p) => (
              <div key={p.id} style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 'var(--font-base)' }}>{p.name}</strong>
                  <Badge type="status" value="in_progress" label={p.frequency} />
                </div>

                <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {p.exercises.map((ex, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: 'var(--color-surface-hover)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-xs)',
                      }}
                    >
                      <span>{ex.name}</span>
                      <strong style={{ color: 'var(--color-muted-text)' }}>{ex.durationMinutes} mins</strong>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                  <Button size="sm" variant="outline">
                    Modify Plan
                  </Button>
                  <Button size="sm" variant="primary">
                    ✓ Log Completed Today
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* History & Guilt-Free Rule */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
            🧘 Mindful Fitness & Rest Days
          </h2>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)', lineHeight: 1.5 }}>
            Rest and recovery days are essential for growth and energy. Modifying or skipping workouts when sick, tired, or busy is encouraged without guilt or streak penalties.
          </p>

          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-secondary-subtle)',
              border: '1px solid var(--color-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text)',
              lineHeight: 1.5,
            }}
          >
            <strong>💡 Pro Tip:</strong> If you are studying for college exams, replace long heavy workouts with a 15-minute brisk walk and neck/shoulder stretches to boost focus.
          </div>
        </Card>
      </div>
    </div>
  );
}
