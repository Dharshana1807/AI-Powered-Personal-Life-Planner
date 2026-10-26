import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import DatePicker from '../components/common/DatePicker.jsx';
import NutritionProgressBars from '../components/diet/NutritionProgressBars.jsx';
import EditTargetsModal from '../components/diet/EditTargetsModal.jsx';
import LogMealModal from '../components/diet/LogMealModal.jsx';
import FoodLogList from '../components/diet/FoodLogList.jsx';
import PlannedMealsSection from '../components/diet/PlannedMealsSection.jsx';
import {
  loadNutritionState,
  getDailyConsumedTotals,
  addConsumedMeal,
  updateConsumedMeal,
  deleteConsumedMeal,
  updateDailyTargets,
  getPlannedMealsForDate,
  markPlannedMealAsEaten,
  unmarkPlannedMealAsEaten,
  NUTRITION_UPDATE_EVENT,
} from '../utils/nutritionStorage.js';
import { toLocalISODate, formatLocalDateString } from '../utils/dateUtils.js';
import { usePlanner } from '../context/PlannerContext.jsx';

function shiftDateString(dateStr, offsetDays) {
  if (!dateStr) return toLocalISODate();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10) + offsetDays;
  const d = new Date(year, month, day);
  return toLocalISODate(d);
}

export default function DietNutrition() {
  const { selectedDate, setSelectedDate, getPlan } = usePlanner();

  // Active date for the food log (defaults to planner's selectedDate or today)
  const currentDate = selectedDate || toLocalISODate();
  const todayDate = toLocalISODate();
  const isToday = currentDate === todayDate;

  // Local state for nutrition data
  const [nutritionState, setNutritionState] = useState(() => loadNutritionState());
  const [consumedTotals, setConsumedTotals] = useState(() => getDailyConsumedTotals(currentDate));

  // Modal controls
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [mealToEdit, setMealToEdit] = useState(null);
  const [isEditTargetsOpen, setIsEditTargetsOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Reload state helper
  const refreshNutrition = () => {
    const updated = loadNutritionState();
    setNutritionState(updated);
    setConsumedTotals(getDailyConsumedTotals(currentDate));
  };

  // Sync totals whenever date changes
  useEffect(() => {
    refreshNutrition();
  }, [currentDate]);

  // Subscribe to global nutrition update events across pages
  useEffect(() => {
    const handleUpdate = () => {
      refreshNutrition();
    };
    window.addEventListener(NUTRITION_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(NUTRITION_UPDATE_EVENT, handleUpdate);
  }, [currentDate]);

  // Planned meals for active date
  const plannedMeals = getPlannedMealsForDate(currentDate, getPlan(currentDate));
  const eatenMeals = (nutritionState.eatenLog && nutritionState.eatenLog[currentDate]) || [];

  // Handlers for logging and editing meals
  const handleOpenAddModal = () => {
    setMealToEdit(null);
    setIsLogModalOpen(true);
  };

  const handleOpenEditModal = (meal) => {
    setMealToEdit(meal);
    setIsLogModalOpen(true);
  };

  const handleSaveMeal = (mealData) => {
    if (mealData.id) {
      updateConsumedMeal(currentDate, mealData.id, mealData);
    } else {
      addConsumedMeal(currentDate, mealData);
    }
    refreshNutrition();
  };

  const handleDeleteMeal = (mealId) => {
    deleteConsumedMeal(currentDate, mealId);
    refreshNutrition();
  };

  const handleMarkAsEaten = (plannedMeal, customItems = null) => {
    markPlannedMealAsEaten(currentDate, plannedMeal, customItems);
    refreshNutrition();
  };

  const handleUnmarkAsEaten = (plannedMealId) => {
    unmarkPlannedMealAsEaten(currentDate, plannedMealId);
    refreshNutrition();
  };

  const handleOpenCustomizePlannedMeal = (plannedMeal) => {
    setMealToEdit({
      mealType: plannedMeal.mealType || plannedMeal.name || 'Lunch',
      name: `${plannedMeal.name || plannedMeal.mealType} (Planned)`,
      time: plannedMeal.startTime || '12:00',
      fromPlannedId: plannedMeal.id,
      items: [
        {
          id: `item-${Date.now()}`,
          foodName: plannedMeal.name || 'Standard Planned Plate',
          quantity: 1,
          unit: 'serving',
          calories: plannedMeal.estimatedCalories || 400,
          protein: plannedMeal.estimatedProtein || 18,
          fiber: plannedMeal.estimatedFiber || 6,
          carbs: plannedMeal.estimatedCarbs || 55,
          fat: plannedMeal.estimatedFat || 12,
        },
      ],
    });
    setIsLogModalOpen(true);
  };

  const handleSaveTargets = (newTargets) => {
    updateDailyTargets(newTargets);
    refreshNutrition();
  };

  const suggestedPrompts = [
    'How do my consumed nutrition totals today compare with my daily targets?',
    'Suggest high-protein Indian vegetarian snack ideas without eggs',
    'How can I reach 110g of protein and 35g of fiber on a budget in India?',
    'What healthy dinner can I make using yellow dal, curd, and spinach?',
  ];

  return (
    <div style={{ maxWidth: '1060px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="Diet & Nutrition Tracker"
        description="Log your eaten meals to automatically calculate calories, protein, fiber, carbs, and fat. Separates planned routine meals from consumed meals."
        suggestedPrompts={suggestedPrompts}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              onClick={() => (window.location.hash = '#/assistant?prompt=Review%20my%20diet%20totals%20today%20and%20give%20me%20insights')}
            >
              🥗 Ask Nutrition Coach
            </Button>
            <Button variant="primary" onClick={handleOpenAddModal}>
              + Log Eaten Meal
            </Button>
          </div>
        }
      />

      {/* Date Switcher & Day Navigation Bar */}
      <Card padding="md">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedDate(shiftDateString(currentDate, -1))}
              title="Previous day"
            >
              ← Prev Day
            </Button>

            <Button
              size="sm"
              variant={isToday ? 'primary' : 'outline'}
              onClick={() => setSelectedDate(todayDate)}
              title="Jump to today"
            >
              📅 Today
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedDate(shiftDateString(currentDate, 1))}
              title="Next day"
            >
              Next Day →
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
              {formatLocalDateString(currentDate)}
            </span>
            <div style={{ width: '170px' }}>
              <DatePicker
                id="diet-date-picker"
                value={currentDate}
                onChange={(newDate) => setSelectedDate(newDate)}
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Daily Progress Bars Against Targets */}
      <NutritionProgressBars
        totals={consumedTotals}
        targets={nutritionState.targets}
        onOpenEditTargets={() => setIsEditTargetsOpen(true)}
      />

      {/* Planned vs Consumed Separation Section */}
      <PlannedMealsSection
        date={currentDate}
        plannedMeals={plannedMeals}
        onMarkAsEaten={handleMarkAsEaten}
        onUnmarkAsEaten={handleUnmarkAsEaten}
        onOpenLogModalWithMeal={handleOpenCustomizePlannedMeal}
      />

      {/* Consumed Daily Food Log */}
      <FoodLogList
        date={currentDate}
        meals={eatenMeals}
        totals={consumedTotals}
        onOpenLogModal={handleOpenAddModal}
        onEditMeal={handleOpenEditModal}
        onDeleteMeal={handleDeleteMeal}
      />

      {/* Bottom Grid: Custom Foods & Recipe Library */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Custom Foods Library */}
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: 0 }}>
              ⭐ Custom Foods Library ({(nutritionState.customFoods || []).length})
            </h2>
            <Button size="sm" variant="outline" onClick={handleOpenAddModal}>
              + Add Custom Food
            </Button>
          </div>

          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-3)' }}>
            Foods you manually created with custom calories and macros. Saved in your browser for instant autocomplete.
          </p>

          {(!nutritionState.customFoods || nutritionState.customFoods.length === 0) ? (
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border)',
                textAlign: 'center',
                fontSize: 'var(--font-sm)',
                color: 'var(--color-muted-text)',
              }}
            >
              No custom foods added yet. When you type an unlisted food while logging, choose "Enter Nutrition Manually" to save it here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '280px', overflowY: 'auto' }}>
              {nutritionState.customFoods.map((cFood) => (
                <div
                  key={cFood.id}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{cFood.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                      {cFood.servingSize || '1 serving'} • {cFood.calories} kcal
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                    <span style={{ backgroundColor: 'var(--color-secondary-subtle)', color: 'var(--color-secondary-accent)', padding: '2px 6px', borderRadius: '4px' }}>
                      {cFood.protein}g P
                    </span>
                    <span style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-text)', padding: '2px 6px', borderRadius: '4px' }}>
                      {cFood.fiber}g Fib
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recipe Library */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
            📖 Indian Recipe Ideas ({(nutritionState.recipes || []).length})
          </h2>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-3)' }}>
            Balanced vegetarian recipes with estimated macro profiles.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '280px', overflowY: 'auto' }}>
            {(nutritionState.recipes || []).map((rec) => (
              <div
                key={rec.id}
                style={{
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-sm)' }}>{rec.name}</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                    {rec.mealType} • ⏱ {rec.prepTimeMinutes} mins
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--color-primary-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                      ⚡ ~{rec.calories} kcal
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--color-secondary-subtle)', color: 'var(--color-secondary-accent)', padding: '2px 6px', borderRadius: '4px' }}>
                      🍗 ~{rec.protein}g Protein
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-text)', padding: '2px 6px', borderRadius: '4px' }}>
                      🌱 ~{rec.fiber}g Fiber
                    </span>
                  </div>
                </div>

                <Button size="sm" variant="outline" onClick={() => setSelectedRecipe(rec)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Log Meal Modal (Add / Edit) */}
      <LogMealModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setMealToEdit(null);
        }}
        selectedDate={currentDate}
        mealToEdit={mealToEdit}
        customFoods={nutritionState.customFoods || []}
        onSaveMeal={handleSaveMeal}
        onCustomFoodAdded={() => refreshNutrition()}
      />

      {/* Edit Targets Modal */}
      <EditTargetsModal
        isOpen={isEditTargetsOpen}
        onClose={() => setIsEditTargetsOpen(false)}
        currentTargets={nutritionState.targets}
        onSaveTargets={handleSaveTargets}
      />

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--color-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '540px',
              width: '100%',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, margin: 0 }}>{selectedRecipe.name}</h2>
              <button
                type="button"
                onClick={() => setSelectedRecipe(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '4px' }}>
              Estimated: ~{selectedRecipe.calories} kcal • ~{selectedRecipe.protein}g protein • ~{selectedRecipe.fiber}g fiber
            </div>

            <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, margin: 'var(--space-4) 0 var(--space-2)' }}>Ingredients</h3>
            <ul style={{ fontSize: 'var(--font-sm)', paddingLeft: '20px', lineHeight: 1.5 }}>
              {selectedRecipe.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>

            <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, margin: 'var(--space-4) 0 var(--space-2)' }}>Preparation Steps</h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)', lineHeight: 1.5 }}>
              {selectedRecipe.instructions}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
              <Button variant="primary" onClick={() => setSelectedRecipe(null)}>
                Close Recipe
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
