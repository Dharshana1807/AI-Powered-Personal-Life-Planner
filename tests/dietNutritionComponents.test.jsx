import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import NutritionProgressBars from '../client/src/components/diet/NutritionProgressBars.jsx';
import FoodLogList from '../client/src/components/diet/FoodLogList.jsx';
import PlannedMealsSection from '../client/src/components/diet/PlannedMealsSection.jsx';
import DietDashboardSummary from '../client/src/components/dashboard/DietDashboardSummary.jsx';
import LogMealModal from '../client/src/components/diet/LogMealModal.jsx';
import EditTargetsModal from '../client/src/components/diet/EditTargetsModal.jsx';

describe('Diet & Nutrition UI Components (Server-Side Render Testing)', () => {
  beforeEach(() => {
    global.window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  });

  it('NutritionProgressBars renders all 5 nutrients and progress percentages', () => {
    const totals = { calories: 850, protein: 42, fiber: 14, carbs: 95, fat: 22 };
    const targets = { calories: 2100, protein: 110, fiber: 35, carbs: 260, fat: 60 };

    const html = renderToString(
      React.createElement(NutritionProgressBars, {
        totals,
        targets,
        onOpenEditTargets: () => {},
      })
    );

    expect(html).toContain('Calories');
    expect(html).toContain('Protein');
    expect(html).toContain('Fiber');
    expect(html).toContain('Carbs');
    expect(html).toContain('Fat');
    expect(html).toContain('850 kcal');
    expect(html).toContain('42g');
    expect(html).toContain('14g');
    expect(html).toContain('Edit Targets');
  });

  it('FoodLogList renders empty state when no meals exist for date', () => {
    const html = renderToString(
      React.createElement(FoodLogList, {
        date: '2026-10-25',
        meals: [],
        totals: { calories: 0, protein: 0, fiber: 0, carbs: 0, fat: 0 },
        onOpenLogModal: () => {},
        onEditMeal: () => {},
        onDeleteMeal: () => {},
      })
    );

    expect(html).toContain('No meals logged for this date yet');
    expect(html).toContain('+ Log Eaten Meal');
  });

  it('FoodLogList renders logged meals with breakdown and action buttons', () => {
    const meals = [
      {
        id: 'meal-1',
        name: 'South Indian Morning Feast',
        mealType: 'Breakfast',
        time: '08:30',
        items: [
          { id: 'item-1', foodName: 'Idli', quantity: 2, unit: 'piece', calories: 116 },
          { id: 'item-2', foodName: 'Sambar', quantity: 1, unit: 'bowl', calories: 110 },
        ],
        calories: 226,
        protein: 8.8,
        fiber: 5.4,
        carbs: 40.0,
        fat: 3.4,
      },
    ];

    const html = renderToString(
      React.createElement(FoodLogList, {
        date: '2026-10-25',
        meals,
        totals: { calories: 226, protein: 8.8, fiber: 5.4, carbs: 40.0, fat: 3.4 },
        onOpenLogModal: () => {},
        onEditMeal: () => {},
        onDeleteMeal: () => {},
      })
    );

    expect(html).toContain('South Indian Morning Feast');
    expect(html).toContain('Breakfast');
    expect(html).toContain('piece');
    expect(html).toContain('Idli');
    expect(html).toContain('bowl');
    expect(html).toContain('226');
    expect(html).toContain('kcal');
    expect(html).toContain('Edit');
    expect(html).toContain('RUNNING CONSUMPTION TOTAL');
  });

  it('PlannedMealsSection displays planned meals with strict separation note and mark as eaten button', () => {
    const plannedMeals = [
      {
        id: 'planned-1',
        name: 'Breakfast',
        mealType: 'Breakfast',
        startTime: '08:00',
        endTime: '08:30',
        estimatedCalories: 350,
        estimatedProtein: 15,
        estimatedFiber: 6,
        eaten: false,
      },
      {
        id: 'planned-2',
        name: 'Lunch',
        mealType: 'Lunch',
        startTime: '13:00',
        endTime: '13:45',
        estimatedCalories: 550,
        estimatedProtein: 22,
        estimatedFiber: 8,
        eaten: true,
      },
    ];

    const html = renderToString(
      React.createElement(PlannedMealsSection, {
        date: '2026-10-25',
        plannedMeals,
        onMarkAsEaten: () => {},
        onUnmarkAsEaten: () => {},
        onOpenLogModalWithMeal: () => {},
      })
    );

    expect(html).toContain('Strict Separation: Planned ≠ Consumed');
    expect(html).toContain('Mark as eaten');
    expect(html).toContain('Mark as not eaten');
    expect(html).toContain('Consumed');
  });

  it('DietDashboardSummary renders on Dashboard and displays nutrition metrics', () => {
    const html = renderToString(
      React.createElement(DietDashboardSummary, {
        selectedDate: '2026-10-25',
      })
    );

    expect(html).toContain('NUTRITION &amp; MEAL TRACKING SUMMARY');
    expect(html).toContain('Open Meal Tracker');
    expect(html).toContain('Calories');
    expect(html).toContain('Protein');
    expect(html).toContain('Fiber');
  });

  it('LogMealModal renders in open state with meal types and natural entry prompt', () => {
    const html = renderToString(
      React.createElement(LogMealModal, {
        isOpen: true,
        onClose: () => {},
        selectedDate: '2026-10-25',
        customFoods: [],
        onSaveMeal: () => {},
        onCustomFoodAdded: () => {},
      })
    );

    expect(html).toContain('Log Consumed Meal');
    expect(html).toContain('MEAL TYPE');
    expect(html).toContain('Natural Text Input');
    expect(html).toContain('Item-by-Item Search &amp; Autocomplete');
  });

  it('EditTargetsModal renders input fields for all 5 macro and energy targets', () => {
    const html = renderToString(
      React.createElement(EditTargetsModal, {
        isOpen: true,
        onClose: () => {},
        currentTargets: { calories: 2100, protein: 110, fiber: 35, carbs: 260, fat: 60 },
        onSaveTargets: () => {},
      })
    );

    expect(html).toContain('Edit Daily Nutrition Targets');
    expect(html).toContain('Daily Calories (kcal)');
    expect(html).toContain('Daily Protein (grams)');
    expect(html).toContain('Daily Fiber (grams)');
    expect(html).toContain('Daily Carbs (grams)');
    expect(html).toContain('Daily Fat (grams)');
  });
});
