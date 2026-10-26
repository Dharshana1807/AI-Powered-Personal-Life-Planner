import React, { useState, useEffect } from 'react';
import Card from '../common/Card.jsx';
import Badge from '../common/Badge.jsx';
import {
  loadGoalChecklists,
  loadStudyData,
  loadCareerData,
  loadFitnessData,
} from '../../utils/storage.js';
import {
  loadNutritionState,
  getDailyConsumedTotals,
  NUTRITION_UPDATE_EVENT,
} from '../../utils/nutritionStorage.js';

export default function GoalProgressOverview({ selectedDate }) {
  const [goals, setGoals] = useState(() => loadGoalChecklists());
  const [study, setStudy] = useState(() => loadStudyData());
  const [career, setCareer] = useState(() => loadCareerData());
  const [nutrition, setNutrition] = useState(() => loadNutritionState());
  const [consumed, setConsumed] = useState(() => getDailyConsumedTotals(selectedDate));
  const [fitness, setFitness] = useState(() => loadFitnessData());

  const refreshAll = () => {
    setGoals(loadGoalChecklists());
    setStudy(loadStudyData());
    setCareer(loadCareerData());
    setNutrition(loadNutritionState());
    setConsumed(getDailyConsumedTotals(selectedDate));
    setFitness(loadFitnessData());
  };

  useEffect(() => {
    refreshAll();
  }, [selectedDate]);

  useEffect(() => {
    const handleNutrUpdate = () => {
      setNutrition(loadNutritionState());
      setConsumed(getDailyConsumedTotals(selectedDate));
    };
    window.addEventListener(NUTRITION_UPDATE_EVENT, handleNutrUpdate);
    return () => window.removeEventListener(NUTRITION_UPDATE_EVENT, handleNutrUpdate);
  }, [selectedDate]);

  // 1. Education Progress
  const eduGoals = goals.education || [];
  const eduTotal = (study.topics || []).length + eduGoals.length;
  const eduCompleted =
    (study.topics || []).filter((t) => t.completed).length +
    eduGoals.filter((g) => g.completed).length;
  const eduPercent = eduTotal > 0 ? Math.round((eduCompleted / eduTotal) * 100) : 0;
  const nextEduAssignment = (study.assignments || []).find((a) => !a.completed);
  const nextEduAction = nextEduAssignment
    ? `Assignment: ${nextEduAssignment.title} (Due ${nextEduAssignment.deadlineDate || 'soon'})`
    : eduGoals.find((g) => !g.completed)?.title || 'All current study topics up to date';

  // 2. Career Progress
  const carGoals = goals.career || [];
  const carTotal = (career.skills || []).length + (career.milestones || []).length + carGoals.length;
  const carCompleted =
    (career.skills || []).filter((s) => s.learned).length +
    (career.milestones || []).filter((m) => m.completed).length +
    carGoals.filter((g) => g.completed).length;
  const carPercent = carTotal > 0 ? Math.round((carCompleted / carTotal) * 100) : 0;
  const nextMilestone = (career.milestones || []).find((m) => !m.completed);
  const nextCarAction = nextMilestone
    ? `Target: ${nextMilestone.title} (Due ${nextMilestone.deadlineDate || 'soon'})`
    : carGoals.find((g) => !g.completed)?.title || 'Docker & Cloud portfolio deployment';

  // 3. Diet Progress
  const targets = nutrition.targets || { calories: 2100, protein: 110 };
  const dietPercent = Math.min(100, Math.round(((consumed.calories || 0) / (targets.calories || 2100)) * 100));
  const dietGoals = goals.diet || [];
  const dietPendingGoal = dietGoals.find((g) => !g.completed);
  const nextDietAction =
    consumed.protein < targets.protein
      ? `${targets.protein - consumed.protein}g protein remaining today`
      : dietPendingGoal
      ? dietPendingGoal.title
      : 'Calorie & protein target achieved!';

  // 4. Fitness Progress
  const fitGoals = goals.fitness || [];
  const fitTotal = Math.max(1, fitGoals.length + (fitness.plans?.[0]?.exercises?.length || 4));
  const fitCompleted = fitGoals.filter((g) => g.completed).length;
  const fitPercent = Math.min(100, Math.round((fitCompleted / fitTotal) * 100));
  const nextFitAction = fitGoals.find((g) => !g.completed)?.title ||
    fitness.plans?.[0]?.name ||
    'Daily mobility & core workout routine (25 mins)';

  const cards = [
    {
      id: 'education',
      title: 'Education',
      icon: '🎓',
      subtitle: study.subjects?.[0]?.name || 'CS Curriculum & Exam Prep',
      percent: eduPercent,
      current: `${eduCompleted} / ${eduTotal} tasks & topics`,
      nextAction: nextEduAction,
      path: '#/goals/education',
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
      borderColor: 'var(--color-info-border)',
    },
    {
      id: 'career',
      title: 'Career',
      icon: '💼',
      subtitle: career.targetRoles?.[0]?.title || 'Cloud Support Engineer Roadmap',
      percent: carPercent,
      current: `${carCompleted} / ${carTotal} skills & milestones`,
      nextAction: nextCarAction,
      path: '#/goals/career',
      color: 'var(--color-primary-active)',
      bgColor: 'var(--color-primary-subtle)',
      borderColor: 'var(--color-primary-hover)',
    },
    {
      id: 'diet',
      title: 'Diet & Nutrition',
      icon: '🥗',
      subtitle: 'Target: 2,100 kcal & 110g Protein',
      percent: dietPercent,
      current: `${consumed.calories} / ${targets.calories} kcal consumed`,
      nextAction: nextDietAction,
      path: '#/goals/diet',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      borderColor: 'var(--color-success-border)',
    },
    {
      id: 'fitness',
      title: 'Fitness',
      icon: '💪',
      subtitle: fitness.plans?.[0]?.name || 'Daily Functional Movement',
      percent: fitPercent,
      current: `${fitCompleted} goals logged today`,
      nextAction: nextFitAction,
      path: '#/goals/fitness',
      color: 'var(--color-secondary-accent)',
      bgColor: 'var(--color-secondary-subtle)',
      borderColor: 'var(--color-secondary-hover)',
    },
  ];

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '20px' }}>🎯</span>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-muted-text)' }}>
              GOAL PROGRESS OVERVIEW
            </div>
            <strong style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
              Real-time progress across personal growth roadmaps
            </strong>
          </div>
        </div>

        <a
          href="#/goals"
          style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            color: 'var(--color-text)',
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          View All Goals &rarr;
        </a>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {cards.map((c) => (
          <a
            key={c.id}
            href={c.path}
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
              textDecoration: 'none',
              color: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '16px' }}>{c.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
                    {c.title}
                  </span>
                </div>
                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text)' }}>
                  {c.percent}%
                </span>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-muted-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: '8px',
                }}
              >
                {c.subtitle}
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: '6px',
                  backgroundColor: 'var(--color-border)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    width: `${c.percent}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-primary-active)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                {c.current}
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                backgroundColor: 'var(--color-surface-hover)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                lineHeight: 1.3,
                marginTop: '4px',
              }}
            >
              <strong>Next:</strong> {c.nextAction}
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}
