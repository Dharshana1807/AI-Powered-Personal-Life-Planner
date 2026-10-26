import { describe, it, expect, beforeEach } from 'vitest';
import { INDIAN_NUTRITION_DATABASE } from '../client/src/data/nutritionDatabase.js';
import {
  parseQuantity,
  extractQuantityAndFood,
  findBestFoodMatch,
  calculateItemNutrition,
  calculateMealTotals,
  parseNaturalMeal,
} from '../client/src/utils/mealParser.js';
import {
  loadNutritionState,
  saveNutritionState,
  getDailyConsumedTotals,
  addConsumedMeal,
  updateConsumedMeal,
  deleteConsumedMeal,
  saveCustomFood,
  updateDailyTargets,
  getPlannedMealsForDate,
  markPlannedMealAsEaten,
  unmarkPlannedMealAsEaten,
  NUTRITION_UPDATE_EVENT,
  DEFAULT_DAILY_TARGETS,
} from '../client/src/utils/nutritionStorage.js';

describe('1. Built-in Nutrition Database Requirements', () => {
  it('contains at least 60 common Indian food items', () => {
    expect(INDIAN_NUTRITION_DATABASE.length).toBeGreaterThanOrEqual(60);
  });

  it('contains all explicitly requested foods in specification', () => {
    const requiredFoods = [
      'idli',
      'dosa',
      'rice',
      'chapati',
      'sambar',
      'chutney',
      'dal',
      'curd',
      'upma',
      'pongal',
      'poori',
      'biryani',
      'paneer',
      'egg',
      'chicken curry',
      'banana',
      'milk',
      'tea',
      'coffee',
    ];

    for (const foodName of requiredFoods) {
      const match = findBestFoodMatch(foodName);
      expect(match, `Expected to find food match for: ${foodName}`).not.toBeNull();
      expect(match.food).toBeDefined();
    }
  });

  it('each database entry has name, aliases, unit, servingSize, and per-serving nutrition values', () => {
    for (const food of INDIAN_NUTRITION_DATABASE) {
      expect(food.id).toBeTypeOf('string');
      expect(food.name).toBeTypeOf('string');
      expect(Array.isArray(food.aliases)).toBe(true);
      expect(food.aliases.length).toBeGreaterThan(0);
      expect(food.unit).toBeTypeOf('string');
      expect(food.servingSize).toBeTypeOf('string');
      expect(food.calories).toBeTypeOf('number');
      expect(food.protein).toBeTypeOf('number');
      expect(food.fiber).toBeTypeOf('number');
      expect(food.carbs).toBeTypeOf('number');
      expect(food.fat).toBeTypeOf('number');
      expect(food.calories).toBeGreaterThanOrEqual(0);
      expect(food.protein).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('2. Meal Entry & Parser Requirements', () => {
  it('parses number, fraction, and word quantities correctly', () => {
    expect(parseQuantity('2')).toBe(2);
    expect(parseQuantity('2.5')).toBe(2.5);
    expect(parseQuantity('½')).toBe(0.5);
    expect(parseQuantity('1/2')).toBe(0.5);
    expect(parseQuantity('1 ½')).toBe(1.5);
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('one')).toBe(1);
    expect(parseQuantity('two')).toBe(2);
    expect(parseQuantity('three')).toBe(3);
    expect(parseQuantity('half')).toBe(0.5);
    expect(parseQuantity('quarter')).toBe(0.25);
  });

  it('correctly calculates "2 idli" nutrition values', () => {
    const idliFood = findBestFoodMatch('idli').food;
    expect(idliFood).toBeDefined();

    const result = calculateItemNutrition(idliFood, 2);
    expect(result.calories).toBe(idliFood.calories * 2);
    expect(result.protein).toBe(idliFood.protein * 2);
    expect(result.fiber).toBe(idliFood.fiber * 2);
    expect(result.carbs).toBe(idliFood.carbs * 2);
    expect(result.fat).toBe(idliFood.fat * 2);
  });

  it('parses natural form meal string: "2 idli, 1 dosa, 1 cup rice"', () => {
    const parsed = parseNaturalMeal('2 idli, 1 dosa, 1 cup rice');
    expect(parsed.items.length).toBe(3);
    expect(parsed.unmatched.length).toBe(0);

    const idliItem = parsed.items.find((it) => it.foodName.toLowerCase().includes('idli'));
    const dosaItem = parsed.items.find((it) => it.foodName.toLowerCase().includes('dosa'));
    const riceItem = parsed.items.find((it) => it.foodName.toLowerCase().includes('rice'));

    expect(idliItem).toBeDefined();
    expect(idliItem.quantity).toBe(2);

    expect(dosaItem).toBeDefined();
    expect(dosaItem.quantity).toBe(1);

    expect(riceItem).toBeDefined();
    expect(riceItem.quantity).toBe(1);

    expect(parsed.totals.calories).toBeGreaterThan(0);
    expect(parsed.totals.protein).toBeGreaterThan(0);
  });

  it('flags unmatched food items and provides suggestions', () => {
    const parsed = parseNaturalMeal('1 dragonfruit smoothie');
    expect(parsed.unmatched.length).toBe(1);
    expect(parsed.unmatched[0].foodQuery).toBe('dragonfruit smoothie');
    expect(Array.isArray(parsed.unmatched[0].suggestions)).toBe(true);
  });
});

describe('3. Storage, Consumed vs Planned Separation, and Recalculations', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.window = {
      localStorage: {
        getItem: (k) => mockStore[k] || null,
        setItem: (k, v) => {
          mockStore[k] = String(v);
        },
        removeItem: (k) => {
          delete mockStore[k];
        },
        clear: () => {
          mockStore = {};
        },
      },
      dispatchEvent: () => {},
    };
  });

  it('maintains strict separation: planned meals do NOT count toward consumed totals', () => {
    const date = '2026-10-25';
    // Initial consumed totals are 0
    const initialTotals = getDailyConsumedTotals(date);
    expect(initialTotals.calories).toBe(0);
    expect(initialTotals.protein).toBe(0);
    expect(initialTotals.mealCount).toBe(0);

    // Get planned meals (seeded with routine breakfast, lunch, dinner)
    const planned = getPlannedMealsForDate(date);
    expect(planned.length).toBeGreaterThan(0);

    // Consumed totals must STILL be 0
    const afterPlannedCheckTotals = getDailyConsumedTotals(date);
    expect(afterPlannedCheckTotals.calories).toBe(0);
    expect(afterPlannedCheckTotals.protein).toBe(0);
  });

  it('updates consumed totals only after confirming "Mark as eaten", and reverts when unmarked', () => {
    const date = '2026-10-25';
    const planned = getPlannedMealsForDate(date);
    const breakfast = planned[0];

    // Mark as eaten
    const consumedMeal = markPlannedMealAsEaten(date, breakfast);
    expect(consumedMeal).toBeDefined();

    const eatenTotals = getDailyConsumedTotals(date);
    expect(eatenTotals.calories).toBeGreaterThan(0);
    expect(eatenTotals.protein).toBeGreaterThan(0);
    expect(eatenTotals.mealCount).toBe(1);

    // Check planned list reflects eaten status
    const updatedPlanned = getPlannedMealsForDate(date);
    const updatedBreakfast = updatedPlanned.find((p) => p.id === breakfast.id);
    expect(updatedBreakfast.eaten).toBe(true);

    // Unmark as eaten
    unmarkPlannedMealAsEaten(date, breakfast.id);
    const revertedTotals = getDailyConsumedTotals(date);
    expect(revertedTotals.calories).toBe(0);
    expect(revertedTotals.protein).toBe(0);
    expect(revertedTotals.mealCount).toBe(0);
  });

  it('supports logging, editing, and deleting meals with instant recalculation', () => {
    const date = '2026-10-25';
    const meal = addConsumedMeal(date, {
      name: 'Breakfast',
      mealType: 'Breakfast',
      items: [
        { foodName: 'Idli', calories: 116, protein: 4.0, fiber: 1.6, carbs: 24, fat: 0.4, quantity: 2, unit: 'piece' },
      ],
      calories: 116,
      protein: 4.0,
      fiber: 1.6,
      carbs: 24,
      fat: 0.4,
    });

    let totals = getDailyConsumedTotals(date);
    expect(totals.calories).toBe(116);
    expect(totals.protein).toBe(4.0);

    // Edit meal: add a glass of milk (+130 kcal, +6.4 protein)
    updateConsumedMeal(date, meal.id, {
      items: [
        { foodName: 'Idli', calories: 116, protein: 4.0, fiber: 1.6, carbs: 24, fat: 0.4, quantity: 2, unit: 'piece' },
        { foodName: 'Milk', calories: 130, protein: 6.4, fiber: 0, carbs: 9.6, fat: 6.0, quantity: 1, unit: 'glass' },
      ],
      calories: 246,
      protein: 10.4,
      fiber: 1.6,
      carbs: 33.6,
      fat: 6.4,
    });

    totals = getDailyConsumedTotals(date);
    expect(totals.calories).toBe(246);
    expect(totals.protein).toBe(10.4);

    // Delete meal
    deleteConsumedMeal(date, meal.id);
    totals = getDailyConsumedTotals(date);
    expect(totals.calories).toBe(0);
    expect(totals.protein).toBe(0);
  });

  it('supports saving custom foods for future use', () => {
    const customFood = saveCustomFood({
      name: 'Millet Upma',
      unit: 'cup',
      servingSize: '1 cup (approx 150g)',
      calories: 195,
      protein: 6.5,
      fiber: 5.0,
      carbs: 32.0,
      fat: 4.5,
    });

    expect(customFood.id).toBeDefined();
    const state = loadNutritionState();
    expect(state.customFoods.some((f) => f.name === 'Millet Upma')).toBe(true);

    // Custom food can be found by parser
    const match = findBestFoodMatch('Millet Upma', state.customFoods);
    expect(match).not.toBeNull();
    expect(match.food.calories).toBe(195);
  });
});
