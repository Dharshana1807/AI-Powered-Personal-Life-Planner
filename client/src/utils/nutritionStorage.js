import {
  NUTRITION_STORAGE_KEY,
  getDefaultNutritionData,
  loadSavedRoutine,
} from './storage.js';
import { generateId } from './dateUtils.js';
import { calculateMealTotals } from './mealParser.js';

export const NUTRITION_UPDATE_EVENT = 'nutrition-updated';

/**
 * Standard default daily targets.
 */
export const DEFAULT_DAILY_TARGETS = {
  calories: 2100,
  protein: 110,
  fiber: 35,
  carbs: 260,
  fat: 60,
};

/**
 * Normalizes nutrition store object to ensure all required arrays and targets exist.
 */
export function normalizeNutritionData(data) {
  const fallback = getDefaultNutritionData();
  const raw = data && typeof data === 'object' ? data : fallback;

  return {
    targets: {
      ...DEFAULT_DAILY_TARGETS,
      ...(fallback.targets || {}),
      ...(raw.targets || {}),
    },
    recipes: Array.isArray(raw.recipes) ? raw.recipes : fallback.recipes,
    mealPlan: raw.mealPlan && typeof raw.mealPlan === 'object' ? raw.mealPlan : {},
    eatenLog: raw.eatenLog && typeof raw.eatenLog === 'object' ? raw.eatenLog : {},
    customFoods: Array.isArray(raw.customFoods) ? raw.customFoods : [],
  };
}

/**
 * Loads nutrition state from localStorage with safe fallback.
 */
export function loadNutritionState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return normalizeNutritionData(null);
  }
  try {
    const raw = window.localStorage.getItem(NUTRITION_STORAGE_KEY);
    if (!raw) return normalizeNutritionData(null);
    const parsed = JSON.parse(raw);
    return normalizeNutritionData(parsed);
  } catch (err) {
    console.error('Failed to load nutrition state:', err);
    return normalizeNutritionData(null);
  }
}

/**
 * Saves nutrition state to localStorage and dispatches window sync event.
 */
export function saveNutritionState(data) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const normalized = normalizeNutritionData(data);
    window.localStorage.setItem(NUTRITION_STORAGE_KEY, JSON.stringify(normalized));

    // Dispatch global event for instant reactive UI updates
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(NUTRITION_UPDATE_EVENT, { detail: normalized }));
    }
    return true;
  } catch (err) {
    console.error('Failed to save nutrition state:', err);
    return false;
  }
}

/**
 * Computes daily consumed macro totals for a specific date (YYYY-MM-DD).
 * Strict rule: ONLY items in eatenLog count. Planned meals do NOT count.
 */
export function getDailyConsumedTotals(date) {
  const state = loadNutritionState();
  const meals = (state.eatenLog && state.eatenLog[date]) || [];

  const totals = {
    calories: 0,
    protein: 0,
    fiber: 0,
    carbs: 0,
    fat: 0,
    mealCount: meals.length,
  };

  for (const meal of meals) {
    totals.calories += Number(meal.calories) || 0;
    totals.protein += Number(meal.protein) || 0;
    totals.fiber += Number(meal.fiber) || 0;
    totals.carbs += Number(meal.carbs) || 0;
    totals.fat += Number(meal.fat) || 0;
  }

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    mealCount: meals.length,
  };
}

/**
 * Adds a new consumed meal for the specified date.
 */
export function addConsumedMeal(date, mealData) {
  const state = loadNutritionState();
  if (!state.eatenLog[date]) {
    state.eatenLog[date] = [];
  }

  const items = Array.isArray(mealData.items) ? mealData.items : [];
  const calculatedTotals = calculateMealTotals(items);

  const newMeal = {
    id: mealData.id || generateId('meal-eaten'),
    name: mealData.name || `${mealData.mealType || 'Meal'} (${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`,
    mealType: mealData.mealType || 'Breakfast',
    time: mealData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    items,
    calories: Number(mealData.calories !== undefined ? mealData.calories : calculatedTotals.calories) || 0,
    protein: Number(mealData.protein !== undefined ? mealData.protein : calculatedTotals.protein) || 0,
    fiber: Number(mealData.fiber !== undefined ? mealData.fiber : calculatedTotals.fiber) || 0,
    carbs: Number(mealData.carbs !== undefined ? mealData.carbs : calculatedTotals.carbs) || 0,
    fat: Number(mealData.fat !== undefined ? mealData.fat : calculatedTotals.fat) || 0,
    confirmedAt: mealData.confirmedAt || new Date().toISOString(),
    fromPlannedId: mealData.fromPlannedId || null,
  };

  state.eatenLog[date].unshift(newMeal);
  saveNutritionState(state);
  return newMeal;
}

/**
 * Updates an existing consumed meal.
 */
export function updateConsumedMeal(date, mealId, updatedData) {
  const state = loadNutritionState();
  const list = state.eatenLog[date] || [];
  const idx = list.findIndex((m) => m.id === mealId);
  if (idx === -1) return false;

  const current = list[idx];
  const items = Array.isArray(updatedData.items) ? updatedData.items : current.items;
  const calculatedTotals = calculateMealTotals(items);

  list[idx] = {
    ...current,
    ...updatedData,
    items,
    calories: Number(updatedData.calories !== undefined ? updatedData.calories : calculatedTotals.calories) || 0,
    protein: Number(updatedData.protein !== undefined ? updatedData.protein : calculatedTotals.protein) || 0,
    fiber: Number(updatedData.fiber !== undefined ? updatedData.fiber : calculatedTotals.fiber) || 0,
    carbs: Number(updatedData.carbs !== undefined ? updatedData.carbs : calculatedTotals.carbs) || 0,
    fat: Number(updatedData.fat !== undefined ? updatedData.fat : calculatedTotals.fat) || 0,
    updatedAt: new Date().toISOString(),
  };

  state.eatenLog[date] = list;
  saveNutritionState(state);
  return list[idx];
}

/**
 * Deletes a consumed meal.
 * If it came from a planned meal, updates the planned meal status to not eaten.
 */
export function deleteConsumedMeal(date, mealId) {
  const state = loadNutritionState();
  const list = state.eatenLog[date] || [];
  const targetMeal = list.find((m) => m.id === mealId);
  state.eatenLog[date] = list.filter((m) => m.id !== mealId);

  // If this meal was created from a planned meal, reset that planned meal in mealPlan
  if (targetMeal && targetMeal.fromPlannedId && state.mealPlan[date]) {
    state.mealPlan[date] = state.mealPlan[date].map((p) => {
      if (p.id === targetMeal.fromPlannedId) {
        return { ...p, eaten: false, eatenMealId: null };
      }
      return p;
    });
  }

  saveNutritionState(state);
  return true;
}

/**
 * Saves a custom food item entered by the user.
 */
export function saveCustomFood(foodItem) {
  const state = loadNutritionState();
  const customId = foodItem.id || generateId('food-custom');

  const newCustomFood = {
    id: customId,
    name: foodItem.name.trim(),
    aliases: [foodItem.name.trim().toLowerCase(), ...(foodItem.aliases || [])],
    unit: foodItem.unit || 'serving',
    servingSize: foodItem.servingSize || '1 serving',
    calories: Number(foodItem.calories) || 0,
    protein: Number(foodItem.protein) || 0,
    fiber: Number(foodItem.fiber) || 0,
    carbs: Number(foodItem.carbs) || 0,
    fat: Number(foodItem.fat) || 0,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };

  // Replace if exists, else append
  const existingIdx = state.customFoods.findIndex(
    (f) => f.name.toLowerCase() === newCustomFood.name.toLowerCase() || f.id === customId
  );
  if (existingIdx >= 0) {
    state.customFoods[existingIdx] = newCustomFood;
  } else {
    state.customFoods.push(newCustomFood);
  }

  saveNutritionState(state);
  return newCustomFood;
}

/**
 * Updates user's daily macro targets.
 */
export function updateDailyTargets(newTargets) {
  const state = loadNutritionState();
  state.targets = {
    ...state.targets,
    calories: Number(newTargets.calories) || state.targets.calories,
    protein: Number(newTargets.protein) || state.targets.protein,
    fiber: Number(newTargets.fiber) || state.targets.fiber,
    carbs: Number(newTargets.carbs) || state.targets.carbs,
    fat: Number(newTargets.fat) || state.targets.fat,
  };
  saveNutritionState(state);
  return state.targets;
}

/**
 * Retrieves planned meals for a given date.
 * Integrates with:
 * 1. nutrition.mealPlan[date]
 * 2. Routine meals (Breakfast, Lunch, Dinner) from loadSavedRoutine()
 * 3. Daily plan tasks with category 'Diet' / 'Nutrition'
 */
export function getPlannedMealsForDate(date, currentPlan = null) {
  const state = loadNutritionState();
  const savedRoutine = loadSavedRoutine();
  const datePlanned = Array.isArray(state.mealPlan[date]) ? [...state.mealPlan[date]] : [];

  // If no explicit meal plan yet for this date, seed with default routine meals
  if (datePlanned.length === 0 && savedRoutine && Array.isArray(savedRoutine.meals)) {
    for (const rMeal of savedRoutine.meals) {
      datePlanned.push({
        id: `routine-meal-${date}-${rMeal.id || rMeal.name.toLowerCase()}`,
        name: rMeal.name,
        mealType: rMeal.name,
        startTime: rMeal.start,
        endTime: rMeal.end,
        estimatedCalories: rMeal.name.toLowerCase().includes('breakfast') ? 350 : rMeal.name.toLowerCase().includes('lunch') ? 550 : 500,
        estimatedProtein: rMeal.name.toLowerCase().includes('breakfast') ? 15 : 22,
        estimatedFiber: 6,
        estimatedCarbs: 65,
        estimatedFat: 15,
        eaten: false,
        eatenMealId: null,
      });
    }
  }

  // Check eaten status against current eatenLog[date]
  const consumedMeals = state.eatenLog[date] || [];
  return datePlanned.map((p) => {
    const matchingConsumed = consumedMeals.find((c) => c.fromPlannedId === p.id);
    return {
      ...p,
      eaten: Boolean(matchingConsumed || p.eaten),
      eatenMealId: matchingConsumed ? matchingConsumed.id : p.eatenMealId,
    };
  });
}

/**
 * Marks a planned meal as eaten and logs it into consumed meals.
 */
export function markPlannedMealAsEaten(date, plannedMeal, customItems = null) {
  const state = loadNutritionState();

  // If already eaten, do nothing
  const existingConsumed = (state.eatenLog[date] || []).find((c) => c.fromPlannedId === plannedMeal.id);
  if (existingConsumed) {
    return existingConsumed;
  }

  // Create items list
  let items = customItems;
  if (!items || items.length === 0) {
    // Provide a sensible standard default item for the planned meal type
    items = [
      {
        id: generateId('item'),
        foodName: plannedMeal.name || `${plannedMeal.mealType} Standard Plate`,
        quantity: 1,
        unit: 'serving',
        calories: plannedMeal.estimatedCalories || 400,
        protein: plannedMeal.estimatedProtein || 18,
        fiber: plannedMeal.estimatedFiber || 6,
        carbs: plannedMeal.estimatedCarbs || 55,
        fat: plannedMeal.estimatedFat || 12,
        matched: true,
      },
    ];
  }

  const totals = calculateMealTotals(items);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (!state.eatenLog[date]) {
    state.eatenLog[date] = [];
  }

  const consumedMeal = {
    id: generateId('meal-eaten'),
    name: `${plannedMeal.name || plannedMeal.mealType} (Planned)`,
    mealType: plannedMeal.mealType || 'Lunch',
    time: plannedMeal.startTime || timeStr,
    items,
    calories: totals.calories,
    protein: totals.protein,
    fiber: totals.fiber,
    carbs: totals.carbs,
    fat: totals.fat,
    confirmedAt: new Date().toISOString(),
    fromPlannedId: plannedMeal.id,
  };

  state.eatenLog[date].unshift(consumedMeal);

  // Update planned meal state in mealPlan[date]
  if (!state.mealPlan[date]) {
    state.mealPlan[date] = [];
  }
  const existingIdx = state.mealPlan[date].findIndex((p) => p.id === plannedMeal.id);
  if (existingIdx >= 0) {
    state.mealPlan[date][existingIdx] = {
      ...state.mealPlan[date][existingIdx],
      eaten: true,
      eatenMealId: consumedMeal.id,
    };
  } else {
    state.mealPlan[date].push({
      ...plannedMeal,
      eaten: true,
      eatenMealId: consumedMeal.id,
    });
  }

  saveNutritionState(state);
  return consumedMeal;
}

/**
 * Reverts a planned meal from eaten back to not eaten.
 */
export function unmarkPlannedMealAsEaten(date, plannedMealId) {
  const state = loadNutritionState();

  // Remove corresponding eatenLog entry
  if (state.eatenLog[date]) {
    state.eatenLog[date] = state.eatenLog[date].filter((c) => c.fromPlannedId !== plannedMealId);
  }

  // Update planned meal flag in mealPlan[date]
  if (state.mealPlan[date]) {
    state.mealPlan[date] = state.mealPlan[date].map((p) => {
      if (p.id === plannedMealId) {
        return { ...p, eaten: false, eatenMealId: null };
      }
      return p;
    });
  }

  saveNutritionState(state);
  return true;
}
