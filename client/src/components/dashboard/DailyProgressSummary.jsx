import React from 'react';
import Card from '../common/Card.jsx';

export default function DailyProgressSummary({ plan }) {
  const allTasks = plan?.tasks || [];
  const scheduledTasks = allTasks.filter((t) => t.scheduledStart && t.scheduledEnd);
  const scheduledCount = scheduledTasks.length;
  const completedCount = allTasks.filter((t) => t.status === 'completed').length;
  const completionRate = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

  const plannedMins = scheduledTasks.reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);
  const spentMins = allTasks
    .filter((t) => t.status === 'completed')
    .reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);

  const formatMins = (mins) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${mins}m`;
  };

  const unscheduledTasks = plan?.schedule?.unscheduled || [];
  const unscheduledCount = unscheduledTasks.length;

  const stats = [
    {
      id: 'scheduled',
      label: 'Scheduled Tasks',
      value: `${scheduledCount}`,
      subtext: `out of ${allTasks.length} total tasks`,
      icon: '📅',
    },
    {
      id: 'completed',
      label: 'Completed Tasks',
      value: `${completedCount}`,
      subtext: `${completionRate}% completed today`,
      icon: '✓',
      highlight: completedCount > 0,
    },
    {
      id: 'planned_time',
      label: 'Planned vs Spent Time',
      value: `${formatMins(plannedMins)}`,
      subtext: `Actually spent: ${formatMins(spentMins)}`,
      icon: '⏱️',
    },
    {
      id: 'unscheduled',
      label: 'Unscheduled Tasks',
      value: `${unscheduledCount}`,
      subtext: unscheduledCount === 0 ? 'All tasks fit in routine' : `${unscheduledCount} tasks need rescheduling`,
      icon: '⚠️',
      alert: unscheduledCount > 0,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--space-3)',
      }}
    >
      {stats.map((s) => (
        <div
          key={s.id}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid',
            borderColor: s.alert ? 'var(--color-danger-border)' : 'var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {s.label}
            </span>
            <span style={{ fontSize: '14px' }}>{s.icon}</span>
          </div>

          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: s.alert ? 'var(--color-danger)' : 'var(--color-text)' }}>
            {s.value}
          </div>

          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', fontWeight: 500 }}>
            {s.subtext}
          </div>
        </div>
      ))}
    </div>
  );
}
