import React, { useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { loadCareerData, saveCareerData } from '../utils/storage.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export default function CareerPlanner() {
  const [careerData, setCareerData] = useState(() => loadCareerData());

  const toggleSkill = (id) => {
    const updated = {
      ...careerData,
      skills: careerData.skills.map((s) => (s.id === id ? { ...s, learned: !s.learned } : s)),
    };
    setCareerData(updated);
    saveCareerData(updated);
  };

  const toggleMilestone = (id) => {
    const updated = {
      ...careerData,
      milestones: careerData.milestones.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m)),
    };
    setCareerData(updated);
    saveCareerData(updated);
  };

  const suggestedPrompts = [
    'What skills are needed for a Cloud Support Engineer in 2026?',
    'Give me a 4-week roadmap to prepare for the AWS Cloud Practitioner exam',
    'Review my resume points for a DevOps/Support internship',
    'How should I introduce myself in a technical support interview?',
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        title="Career Roadmap & Applications"
        description="Build role-specific skill roadmaps, track certifications, and manage your job applications. (Suggestions are educational guides, not verified job openings)."
        suggestedPrompts={suggestedPrompts}
        actions={
          <Button variant="outline" onClick={() => (window.location.hash = '#/assistant?prompt=Review%20my%20career%20roadmap')}>
            💼 Career Advice with AI
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Target Roles</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px' }}>{careerData.targetRoles.length}</div>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Skills Mastered</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-success)' }}>
            {careerData.skills.filter((s) => s.learned).length} / {careerData.skills.length}
          </div>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>Active Applications</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-info)' }}>
            {careerData.jobApplications.length}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Skills Roadmap */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            🛠️ Skill Roadmap (Target: Cloud / Support)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {careerData.skills.map((sk) => (
              <label
                key={sk.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: sk.learned ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <input
                    type="checkbox"
                    checked={sk.learned}
                    onChange={() => toggleSkill(sk.id)}
                  />
                  <div>
                    <strong style={{ fontSize: 'var(--font-sm)', textDecoration: sk.learned ? 'line-through' : 'none' }}>
                      {sk.name}
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                      Category: {sk.category}
                    </div>
                  </div>
                </div>
                <Badge
                  type="status"
                  value={sk.learned ? 'completed' : 'pending'}
                  label={sk.learned ? 'Learned' : 'In Progress'}
                />
              </label>
            ))}
          </div>
        </Card>

        {/* Milestones & Certifications */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            🎯 Career Milestones & Certifications
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {careerData.milestones.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <input
                    type="checkbox"
                    checked={m.completed}
                    onChange={() => toggleMilestone(m.id)}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', textDecoration: m.completed ? 'line-through' : 'none' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                      Target: {formatDisplayDate(m.deadlineDate)}
                    </div>
                  </div>
                </div>
                <Badge type="status" value={m.completed ? 'completed' : 'pending'} />
              </div>
            ))}
          </div>

          {/* Job Application Tracker */}
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: 'var(--space-5) 0 var(--space-3)' }}>
            📋 Job & Internship Applications ({careerData.jobApplications.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {careerData.jobApplications.map((job) => (
              <div
                key={job.id}
                style={{
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-hover)',
                  fontSize: 'var(--font-xs)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{job.company}</strong> — {job.role}
                  <div style={{ color: 'var(--color-muted-text)', marginTop: '2px' }}>
                    Applied on: {formatDisplayDate(job.appliedDate)} • {job.notes}
                  </div>
                </div>
                <Badge type="status" value="in_progress" label={job.status.toUpperCase()} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
