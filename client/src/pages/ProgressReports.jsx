import React, { useState, useMemo } from 'react';
import PageHeader from '../components/common/PageHeader.jsx';
import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import { getUnifiedStore } from '../utils/storage.js';
import { toLocalISODate, formatLocalDateString } from '../utils/dateUtils.js';

export default function ProgressReports() {
  const [timeframe, setTimeframe] = useState('weekly'); // 'weekly' | 'monthly'
  const todayStr = useMemo(() => toLocalISODate(), []);

  const store = useMemo(() => getUnifiedStore(), []);

  // Compute date list for timeframe
  const dateWindow = useMemo(() => {
    const days = timeframe === 'monthly' ? 30 : 7;
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - i);
      dates.push(toLocalISODate(d));
    }
    return dates;
  }, [timeframe, todayStr]);

  // Aggregate stats over the window
  const windowData = useMemo(() => {
    const plansMap = store.plans || {};
    const dayRecords = [];
    let totalScheduledTasks = 0;
    let totalCompletedTasks = 0;
    let totalPlannedMinutes = 0;
    let totalSpentMinutes = 0;
    let loggedDaysCount = 0;

    dateWindow.forEach((date) => {
      const plan = plansMap[date];
      if (!plan || !plan.tasks || plan.tasks.length === 0) {
        dayRecords.push({
          date,
          dayLabel: date.slice(5),
          hasData: false,
          scheduledCount: 0,
          completedCount: 0,
          plannedMinutes: 0,
          spentMinutes: 0,
        });
      } else {
        loggedDaysCount++;
        const tasks = plan.tasks;
        const scheduled = tasks.filter((t) => t.scheduledStart && t.scheduledEnd);
        const completed = tasks.filter((t) => t.status === 'completed');
        const plannedMins = scheduled.reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);
        const spentMins = completed.reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);

        totalScheduledTasks += scheduled.length;
        totalCompletedTasks += completed.length;
        totalPlannedMinutes += plannedMins;
        totalSpentMinutes += spentMins;

        dayRecords.push({
          date,
          dayLabel: date.slice(5),
          hasData: true,
          scheduledCount: scheduled.length,
          completedCount: completed.length,
          plannedMinutes: plannedMins,
          spentMinutes: spentMins,
        });
      }
    });

    const completionRate =
      totalScheduledTasks > 0 ? Math.round((totalCompletedTasks / totalScheduledTasks) * 100) : 0;

    // Study sessions in window
    const allStudy = store.study?.sessions || [];
    const windowStudy = allStudy.filter((s) => dateWindow.includes(s.date));
    const totalStudyMins = windowStudy.reduce((acc, s) => acc + (Number(s.durationMinutes) || 0), 0);

    // Subject breakdown
    const subjectMins = {};
    (store.study?.subjects || []).forEach((sub) => {
      subjectMins[sub.name] = (store.study?.topics || []).filter(
        (t) => t.subjectId === sub.id && t.completed
      ).length;
    });

    // Habits consistency in window
    const habitsList = store.habits?.items || [];
    const habitHistory = store.habits?.history || {};
    let totalPossibleHabits = habitsList.length * dateWindow.length;
    let totalCheckedHabits = 0;

    habitsList.forEach((h) => {
      dateWindow.forEach((d) => {
        if (habitHistory[h.id]?.[d]) {
          totalCheckedHabits++;
        }
      });
    });

    const habitRate =
      totalPossibleHabits > 0 ? Math.round((totalCheckedHabits / totalPossibleHabits) * 100) : 0;

    // Nutrition intake over window
    const eatenLog = store.nutrition?.eatenLog || {};
    const nutritionDays = [];
    dateWindow.forEach((d) => {
      const dayMeals = eatenLog[d] || [];
      const cals = dayMeals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);
      nutritionDays.push({
        date: d,
        calories: cals,
        logged: dayMeals.length > 0,
      });
    });

    return {
      dayRecords,
      totalScheduledTasks,
      totalCompletedTasks,
      completionRate,
      totalPlannedHours: (totalPlannedMinutes / 60).toFixed(1),
      totalSpentHours: (totalSpentMinutes / 60).toFixed(1),
      loggedDaysCount,
      missingDaysCount: dateWindow.length - loggedDaysCount,
      totalStudyHours: (totalStudyMins / 60).toFixed(1),
      studySessionsCount: windowStudy.length,
      subjectMins,
      habitRate,
      totalCheckedHabits,
      nutritionDays,
    };
  }, [store, dateWindow]);

  const handleAskAI = (promptText) => {
    window.location.hash = `#/assistant?q=${encodeURIComponent(promptText)}`;
  };

  const maxDailyTasks = Math.max(
    1,
    ...windowData.dayRecords.map((d) => Math.max(d.scheduledCount, d.completedCount))
  );

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader
        title="Progress Reports & Analytics"
        description="Authentic performance data computed strictly from your saved records and timetables. Missing days are clearly distinguished from zero progress."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: '2px',
              }}
            >
              {[
                { id: 'weekly', label: 'Last 7 Days' },
                { id: 'monthly', label: 'Last 30 Days' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 'var(--font-xs)',
                    fontWeight: timeframe === tf.id ? 800 : 600,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: timeframe === tf.id ? 'var(--color-primary)' : 'transparent',
                    color: '#000000',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <Button variant="outline" onClick={() => handleAskAI(`Review my ${timeframe} planner progress report`)}>
              🤖 Ask AI to Analyze
            </Button>
          </div>
        }
      />

      {/* Honest Data Banner */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--color-secondary-subtle)',
          border: '1px solid var(--color-secondary)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-text)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <span>🛡️</span>
        <span>
          <strong>Honest Data Accounting:</strong> All metrics below reflect saved timetables and records only. Unlogged dates indicate rest days or skipped tracking, not personal failure or zero performance.
        </span>
      </div>

      {/* High-level KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Schedule Completion
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
            <span style={{ fontSize: 'var(--font-3xl)', fontWeight: 800 }}>{windowData.completionRate}%</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
              ({windowData.totalCompletedTasks}/{windowData.totalScheduledTasks} tasks)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
            {windowData.loggedDaysCount} logged days &bull; {windowData.missingDaysCount} unlogged rest days
          </div>
        </Card>

        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Planned vs Actually Spent Time
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
            <span style={{ fontSize: 'var(--font-3xl)', fontWeight: 800 }}>{windowData.totalSpentHours}h</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
              spent / {windowData.totalPlannedHours}h planned
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
            Across all scheduled timetable blocks
          </div>
        </Card>

        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Study Dedicated
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
            <span style={{ fontSize: 'var(--font-3xl)', fontWeight: 800 }}>{windowData.totalStudyHours}h</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
              ({windowData.studySessionsCount} logged sessions)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
            College subjects and syllabus topics
          </div>
        </Card>

        <Card padding="md">
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Habits Consistency
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
            <span style={{ fontSize: 'var(--font-3xl)', fontWeight: 800 }}>{windowData.habitRate}%</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
              ({windowData.totalCheckedHabits} habit checks)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
            Tracked daily routine habits
          </div>
        </Card>
      </div>

      {/* Chart: Scheduled vs Completed Tasks by Day */}
      <Card padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: 0 }}>
              📊 Daily Scheduled vs Completed Tasks ({timeframe === 'monthly' ? '30 Days' : '7 Days'})
            </h3>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
              Yellow bars show completed tasks; gray outlines show scheduled work. Dashed slots indicate unlogged days.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-primary)', display: 'inline-block', borderRadius: '2px' }} />
              <span>Completed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-border)', display: 'inline-block', borderRadius: '2px' }} />
              <span>Scheduled</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '12px', border: '1px dashed var(--color-border-hover)', display: 'inline-block', borderRadius: '2px' }} />
              <span>No Plan</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Graph */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: timeframe === 'monthly' ? '4px' : '12px',
            height: '180px',
            paddingTop: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            overflowX: 'auto',
          }}
        >
          {windowData.dayRecords.map((d) => {
            const isToday = d.date === todayStr;
            const schedHeight = Math.round((d.scheduledCount / maxDailyTasks) * 140);
            const compHeight = Math.round((d.completedCount / maxDailyTasks) * 140);

            return (
              <div
                key={d.date}
                style={{
                  flex: 1,
                  minWidth: timeframe === 'monthly' ? '18px' : '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '100%',
                }}
                title={`${d.date}: ${d.hasData ? `${d.completedCount}/${d.scheduledCount} completed` : 'No plan logged'}`}
              >
                {d.hasData ? (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: '2px',
                      height: '140px',
                    }}
                  >
                    {/* Scheduled bar */}
                    <div
                      style={{
                        width: '45%',
                        height: `${Math.max(6, schedHeight)}px`,
                        backgroundColor: 'var(--color-border)',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                    {/* Completed bar */}
                    <div
                      style={{
                        width: '45%',
                        height: `${Math.max(6, compHeight)}px`,
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '80%',
                      height: '30px',
                      border: '1px dashed var(--color-border)',
                      borderRadius: '2px',
                      marginBottom: '2px',
                    }}
                  />
                )}

                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: isToday ? 800 : 500,
                    color: isToday ? 'var(--color-text)' : 'var(--color-muted-text)',
                    marginTop: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {timeframe === 'weekly' ? d.dayLabel : d.dayLabel.slice(3)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Goal Checklists & Activity Balance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: '0 0 var(--space-3)' }}>
            🎯 Core Goal Checklists Progress
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { id: 'education', label: 'Education & Study Topics', icon: '🎓', items: store.goals?.education || [] },
              { id: 'career', label: 'Career & Certifications', icon: '💼', items: store.goals?.career || [] },
              { id: 'diet', label: 'Diet & Nutrition Habits', icon: '🥗', items: store.goals?.diet || [] },
              { id: 'fitness', label: 'Fitness & Physical Movement', icon: '💪', items: store.goals?.fitness || [] },
            ].map((cat) => {
              const total = cat.items.length;
              const done = cat.items.filter((i) => i.completed).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <div key={cat.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700 }}>
                      {cat.icon} {cat.label}
                    </span>
                    <span style={{ color: 'var(--color-muted-text)' }}>
                      {done}/{total} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-primary-active)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Nutrition History */}
        <Card padding="md">
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: '0 0 var(--space-3)' }}>
            🥗 Nutrition Intake Over Period
          </h3>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-3)' }}>
            Confirmed meals intake compared against your 2,100 kcal daily target.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {windowData.nutritionDays.slice(-5).map((nd) => {
              const target = store.nutrition?.targets?.calories || 2100;
              const pct = Math.min(100, Math.round((nd.calories / target) * 100));
              return (
                <div key={nd.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--font-xs)' }}>
                  <span style={{ width: '80px', color: 'var(--color-muted-text)' }}>{nd.date.slice(5)}</span>
                  <div style={{ flex: 1, margin: '0 var(--space-3)', height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: nd.logged ? 'var(--color-success)' : 'transparent' }} />
                  </div>
                  <span style={{ width: '90px', textAlign: 'right', fontWeight: 600 }}>
                    {nd.logged ? `${nd.calories} kcal` : 'Unlogged'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
