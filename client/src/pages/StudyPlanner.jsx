import React, { useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { loadStudyData, saveStudyData } from '../utils/storage.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export default function StudyPlanner() {
  const [studyData, setStudyData] = useState(() => loadStudyData());

  const toggleTopic = (id) => {
    const updated = {
      ...studyData,
      topics: studyData.topics.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    };
    setStudyData(updated);
    saveStudyData(updated);
  };

  const toggleAssignment = (id) => {
    const updated = {
      ...studyData,
      assignments: studyData.assignments.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)),
    };
    setStudyData(updated);
    saveStudyData(updated);
  };

  const suggestedPrompts = [
    'Explain process synchronization and semaphores with a real-life analogy',
    'Create a 5-day revision plan for Computer Networks before Nov 20',
    'Give me 3 practice interview questions on Operating Systems',
    'How do I calculate subnets and CIDR quickly?',
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        title="Study Planner & Exam Strategy"
        description="Organize subjects, track syllabus topics, manage assignments, and prepare for upcoming exams."
        suggestedPrompts={suggestedPrompts}
        actions={
          <Button variant="outline" onClick={() => (window.location.hash = '#/assistant?prompt=Help%20me%20structure%20my%20study%20plan')}>
            🤖 Ask AI Study Coach
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Active Subjects</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px' }}>{studyData.subjects.length}</div>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Completed Topics</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-success)' }}>
            {studyData.topics.filter((t) => t.completed).length} / {studyData.topics.length}
          </div>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Pending Assignments</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-danger)' }}>
            {studyData.assignments.filter((a) => !a.completed).length}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Subjects & Topics */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            📚 Subjects & Exam Deadlines
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {studyData.subjects.map((sub) => (
              <div key={sub.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 'var(--font-base)' }}>{sub.name}</strong>
                  {sub.examDate && (
                    <Badge type="status" value="rescheduled" label={`Exam: ${formatDisplayDate(sub.examDate)}`} />
                  )}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '4px' }}>
                  {sub.notes}
                </div>

                {/* Sub-topics */}
                <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {studyData.topics
                    .filter((t) => t.subjectId === sub.id)
                    .map((top) => (
                      <label
                        key={top.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--font-xs)',
                          cursor: 'pointer',
                          backgroundColor: top.completed ? 'var(--color-surface-hover)' : 'var(--color-bg)',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={top.completed}
                          onChange={() => toggleTopic(top.id)}
                        />
                        <span style={{ textDecoration: top.completed ? 'line-through' : 'none', color: top.completed ? 'var(--color-muted-text)' : 'inherit' }}>
                          {top.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Assignments */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            📝 Assignments & Practical Labs
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {studyData.assignments.map((asgn) => (
              <div
                key={asgn.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: asgn.completed ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <input
                    type="checkbox"
                    checked={asgn.completed}
                    onChange={() => toggleAssignment(asgn.id)}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', textDecoration: asgn.completed ? 'line-through' : 'none' }}>
                      {asgn.title}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                      Deadline: {formatDisplayDate(asgn.deadlineDate)}
                    </div>
                  </div>
                </div>
                <Badge type="priority" value={asgn.priority} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
