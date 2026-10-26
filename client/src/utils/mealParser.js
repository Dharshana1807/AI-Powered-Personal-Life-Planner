import { INDIAN_NUTRITION_DATABASE } from '../data/nutritionDatabase.js';

/**
 * Word to number dictionary for word-based quantities.
 */
const WORD_NUMBERS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
};

/**
 * Unicode fraction mapping.
 */
const UNICODE_FRACTIONS = {
  '½': 0.5,
  '⅓': 0.333,
  '⅔': 0.667,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/**
 * Unit aliases that can be stripped from the food name if present.
 */
const UNIT_WORDS = [
  'pieces',
  'piece',
  'pcs',
  'pc',
  'cups',
  'cup',
  'bowls',
  'bowl',
  'plates',
  'plate',
  'glasses',
  'glass',
  'grams',
  'gram',
  'gm',
  'gms',
  'g',
  'rotis',
  'roti',
  'chapatis',
  'chapati',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'scoops',
  'scoop',
  'slices',
  'slice',
  'servings',
  'serving',
  'medium',
  'small',
  'large',
  'full',
];

/**
 * Converts a string representation of a quantity (words, fractions, decimals) to a float.
 * @param {string} rawQty
 * @returns {number | null}
 */
export function parseQuantity(rawQty) {
  if (typeof rawQty === 'number') {
    return isNaN(rawQty) || rawQty <= 0 ? null : Math.round(rawQty * 100) / 100;
  }
  if (!rawQty || typeof rawQty !== 'string') return null;

  const str = rawQty.trim().toLowerCase();
  if (!str) return null;

  // 1. Direct word match
  if (WORD_NUMBERS[str] !== undefined) {
    return WORD_NUMBERS[str];
  }

  // 2. Unicode fraction match
  if (UNICODE_FRACTIONS[str] !== undefined) {
    return UNICODE_FRACTIONS[str];
  }

  // 3. Mixed with unicode fraction (e.g., "1 ½" or "2½")
  for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (str.includes(char)) {
      const wholePart = str.replace(char, '').trim();
      const wholeNum = wholePart ? parseFloat(wholePart) : 0;
      if (!isNaN(wholeNum)) {
        return Math.round((wholeNum + val) * 100) / 100;
      }
    }
  }

  // 4. Slash fraction (e.g. "1/2", "3/4", "1 1/2")
  if (str.includes('/')) {
    const parts = str.split(/\s+/);
    if (parts.length === 2) {
      // e.g. "1 1/2"
      const whole = parseFloat(parts[0]);
      const fracParts = parts[1].split('/');
      if (!isNaN(whole) && fracParts.length === 2) {
        const num = parseFloat(fracParts[0]);
        const den = parseFloat(fracParts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          return Math.round((whole + num / den) * 100) / 100;
        }
      }
    } else if (parts.length === 1) {
      const fracParts = str.split('/');
      if (fracParts.length === 2) {
        const num = parseFloat(fracParts[0]);
        const den = parseFloat(fracParts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          return Math.round((num / den) * 100) / 100;
        }
      }
    }
  }

  // 5. Standard decimal / integer float
  const parsed = parseFloat(str);
  if (!isNaN(parsed) && parsed > 0) {
    return Math.round(parsed * 100) / 100;
  }

  return null;
}

/**
 * Computes simple Levenshtein distance for fuzzy matching typos.
 */
function levenshteinDistance(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Searches and scores all database entries (plus custom foods) against query string.
 * @param {string} query
 * @param {Array<object>} [customFoods=[]]
 * @returns {object | null}
 */
export function findBestFoodMatch(query, customFoods = []) {
  if (!query || typeof query !== 'string') return null;

  const rawQuery = query.trim().toLowerCase();
  if (!rawQuery) return null;

  // Clean common trailing 's' or plural endings, e.g. "bananas" -> "banana", "idlis" -> "idli"
  const normalizedQuery = rawQuery.replace(/[^a-z0-9\s]/g, '').trim();
  const singularQuery = normalizedQuery.endsWith('s') && !normalizedQuery.endsWith('ss')
    ? normalizedQuery.slice(0, -1)
    : normalizedQuery;

  const allFoods = [...(customFoods || []), ...INDIAN_NUTRITION_DATABASE];

  // 1. Exact match on name
  for (const food of allFoods) {
    const foodNameLower = food.name.toLowerCase();
    if (foodNameLower === normalizedQuery || foodNameLower === singularQuery) {
      return { food, score: 1.0, isExact: true };
    }
  }

  // 2. Exact match on alias
  for (const food of allFoods) {
    if (Array.isArray(food.aliases)) {
      for (const alias of food.aliases) {
        const aliasLower = alias.toLowerCase();
        if (aliasLower === normalizedQuery || aliasLower === singularQuery) {
          return { food, score: 0.98, isExact: true };
        }
      }
    }
  }

  // 3. Substring match (e.g. query "dosa" in "Masala Dosa" or "white rice" in "Cooked White Rice")
  const substringMatches = [];
  for (const food of allFoods) {
    const foodNameLower = food.name.toLowerCase();
    const aliases = (food.aliases || []).map((a) => a.toLowerCase());

    if (foodNameLower.includes(normalizedQuery) || normalizedQuery.includes(foodNameLower)) {
      substringMatches.push({ food, score: 0.85 });
      continue;
    }

    const matchedAlias = aliases.find(
      (a) => a.includes(normalizedQuery) || normalizedQuery.includes(a) || (singularQuery && a.includes(singularQuery))
    );
    if (matchedAlias) {
      substringMatches.push({ food, score: 0.82 });
    }
  }

  if (substringMatches.length > 0) {
    // Sort by shortest name (closest match)
    substringMatches.sort((a, b) => a.food.name.length - b.food.name.length);
    return substringMatches[0];
  }

  // 4. Token overlap (e.g. "paneer curry" -> matches "Paneer Butter Masala")
  const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);
  let bestTokenMatch = null;
  let maxTokenOverlap = 0;

  for (const food of allFoods) {
    const foodWords = `${food.name} ${(food.aliases || []).join(' ')}`.toLowerCase().split(/\s+/);
    let overlap = 0;
    for (const token of queryTokens) {
      if (foodWords.some((w) => w === token || w.includes(token))) {
        overlap++;
      }
    }
    if (overlap > maxTokenOverlap) {
      maxTokenOverlap = overlap;
      bestTokenMatch = food;
    }
  }

  if (bestTokenMatch && maxTokenOverlap > 0) {
    return { food: bestTokenMatch, score: 0.7, isExact: false };
  }

  // 5. Levenshtein distance fallback for typos
  let closestFood = null;
  let minDistance = Infinity;

  for (const food of allFoods) {
    const distName = levenshteinDistance(food.name, normalizedQuery);
    if (distName < minDistance) {
      minDistance = distName;
      closestFood = food;
    }
    for (const alias of food.aliases || []) {
      const distAlias = levenshteinDistance(alias, normalizedQuery);
      if (distAlias < minDistance) {
        minDistance = distAlias;
        closestFood = food;
      }
    }
  }

  // Only accept if distance is reasonable (e.g. <= 3 for short queries, <= 4 for longer)
  const maxAllowedDist = normalizedQuery.length <= 4 ? 1 : normalizedQuery.length <= 8 ? 2 : 3;
  if (closestFood && minDistance <= maxAllowedDist) {
    return { food: closestFood, score: 0.6, isExact: false };
  }

  return null;
}

/**
 * Gets suggested alternative foods if the food is not matched.
 * Returns up to 4 similar foods.
 * @param {string} query
 * @param {Array<object>} [customFoods=[]]
 * @returns {Array<object>}
 */
export function getFoodSuggestions(query, customFoods = []) {
  if (!query || typeof query !== 'string') return [];
  const rawQuery = query.trim().toLowerCase();
  const allFoods = [...(customFoods || []), ...INDIAN_NUTRITION_DATABASE];

  const scored = [];
  for (const food of allFoods) {
    const nameDist = levenshteinDistance(food.name, rawQuery);
    let bestDist = nameDist;
    for (const alias of food.aliases || []) {
      const aliasDist = levenshteinDistance(alias, rawQuery);
      if (aliasDist < bestDist) bestDist = aliasDist;
    }

    // Boost if token match
    const hasWord = food.name.toLowerCase().includes(rawQuery) || (food.aliases || []).some((a) => a.toLowerCase().includes(rawQuery));
    const score = hasWord ? bestDist - 3 : bestDist;
    scored.push({ food, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 4).map((s) => s.food);
}

/**
 * Autocomplete search for dropdowns.
 * Returns up to 8 matched food items.
 * @param {string} query
 * @param {Array<object>} [customFoods=[]]
 * @returns {Array<object>}
 */
export function searchFoodsAutocomplete(query, customFoods = []) {
  if (!query || typeof query !== 'string') return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const allFoods = [...(customFoods || []), ...INDIAN_NUTRITION_DATABASE];
  const results = [];
  const seenIds = new Set();

  // 1. Starts with query
  for (const food of allFoods) {
    if (food.name.toLowerCase().startsWith(q) || (food.aliases || []).some((a) => a.toLowerCase().startsWith(q))) {
      if (!seenIds.has(food.id)) {
        seenIds.add(food.id);
        results.push(food);
      }
    }
  }

  // 2. Contains query
  if (results.length < 8) {
    for (const food of allFoods) {
      if (food.name.toLowerCase().includes(q) || (food.aliases || []).some((a) => a.toLowerCase().includes(q))) {
        if (!seenIds.has(food.id)) {
          seenIds.add(food.id);
          results.push(food);
        }
      }
    }
  }

  return results.slice(0, 8);
}

/**
 * Parses an individual single string line/clause into quantity and food name.
 * e.g. "2 idli" -> { quantity: 2, foodName: "idli", unit: "piece" }
 * e.g. "1/2 cup curd" -> { quantity: 0.5, foodName: "curd", unit: "cup" }
 * e.g. "two bananas" -> { quantity: 2, foodName: "bananas", unit: "piece" }
 * @param {string} rawClause
 * @returns {{ quantity: number, foodQuery: string, rawText: string }}
 */
export function extractQuantityAndFood(rawClause) {
  if (!rawClause || typeof rawClause !== 'string') {
    return { quantity: 1, foodQuery: '', rawText: '' };
  }

  let text = rawClause.trim();
  const rawText = text;

  // Regex patterns to capture initial quantity
  // Matches e.g.:
  // - "1 1/2"
  // - "1/2", "3/4"
  // - "½", "¼", "¾"
  // - "2.5", "0.5", "3"
  // - "two", "three", "half", "one"
  const wordKeys = Object.keys(WORD_NUMBERS).join('|');
  const fractionKeys = Object.keys(UNICODE_FRACTIONS).join('|');

  const qtyRegex = new RegExp(
    `^(?:(\\d+\\s+\\d+\\/\\d+)|(\\d+\\/\\d+)|([0-9]*[${fractionKeys}])|(\\d+(?:\\.\\d+)?)|(${wordKeys}))\\s*(.*)$`,
    'i'
  );

  let quantity = 1;
  let foodQuery = text;

  const match = text.match(qtyRegex);
  if (match) {
    const rawQtyStr = match[1] || match[2] || match[3] || match[4] || match[5];
    const remaining = (match[6] || '').trim();
    const parsedQty = parseQuantity(rawQtyStr);

    if (parsedQty !== null && parsedQty > 0) {
      quantity = parsedQty;
      foodQuery = remaining;
    }
  }

  // Remove leading unit words if present (e.g. "cup rice" -> "rice", "pieces idli" -> "idli")
  // e.g. "1 cup rice" -> quantity=1, foodQuery="rice"
  const unitRegex = new RegExp(`^(?:of\\s+)?(${UNIT_WORDS.join('|')})\\s*(?:of\\s+)?(.*)$`, 'i');
  const unitMatch = foodQuery.match(unitRegex);
  if (unitMatch) {
    const potentialRemaining = unitMatch[2].trim();
    if (potentialRemaining.length > 0) {
      foodQuery = potentialRemaining;
    }
  }

  // If user only typed a food name with no quantity (e.g. "idli"), default quantity = 1
  return {
    quantity: Math.max(0.1, quantity),
    foodQuery: foodQuery.trim(),
    rawText,
  };
}

/**
 * Calculates item nutrition values given a food database entry and quantity.
 */
export function calculateItemNutrition(food, quantity) {
  const qty = Number(quantity) || 1;
  const round1 = (val) => Math.round((Number(val) || 0) * qty * 10) / 10;
  const round0 = (val) => Math.round((Number(val) || 0) * qty);

  return {
    calories: round0(food.calories),
    protein: round1(food.protein),
    fiber: round1(food.fiber),
    carbs: round1(food.carbs),
    fat: round1(food.fat),
  };
}

/**
 * Sums array of parsed/calculated items into meal totals.
 */
export function calculateMealTotals(items = []) {
  const totals = {
    calories: 0,
    protein: 0,
    fiber: 0,
    carbs: 0,
    fat: 0,
  };

  for (const item of items) {
    if (!item) continue;
    totals.calories += Number(item.calories) || 0;
    totals.protein += Number(item.protein) || 0;
    totals.fiber += Number(item.fiber) || 0;
    totals.carbs += Number(item.carbs) || 0;
    totals.fat += Number(item.fat) || 0;
  }

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
  };
}

/**
 * Natural language meal parser.
 * Takes a natural text string like:
 * "2 idli, 1 dosa, 1 cup rice"
 * or "2 chapatis and 1 bowl dal with 1 glass milk"
 * and resolves items, fuzzy matches foods, computes per-item and total nutrition.
 *
 * @param {string} text
 * @param {Array<object>} [customFoods=[]]
 * @returns {{ items: Array<object>, totals: object, unmatched: Array<object> }}
 */
export function parseNaturalMeal(text, customFoods = []) {
  if (!text || typeof text !== 'string') {
    return { items: [], totals: calculateMealTotals([]), unmatched: [] };
  }

  // Split clauses by commas, semicolons, plus signs, newlines, or " and "
  const clauses = text
    .split(/[,;\n+]|\band\b/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const items = [];
  const unmatched = [];

  for (const clause of clauses) {
    const { quantity, foodQuery, rawText } = extractQuantityAndFood(clause);
    if (!foodQuery) continue;

    const matchResult = findBestFoodMatch(foodQuery, customFoods);

    if (matchResult && matchResult.food) {
      const food = matchResult.food;
      const nutrition = calculateItemNutrition(food, quantity);

      items.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        foodId: food.id,
        foodName: food.name,
        quantity,
        unit: food.unit || 'serving',
        servingSize: food.servingSize,
        ...nutrition,
        matched: true,
        isCustom: Boolean(food.isCustom),
      });
    } else {
      // Unmatched item
      const suggestions = getFoodSuggestions(foodQuery, customFoods);
      unmatched.push({
        rawText,
        foodQuery,
        quantity,
        suggestions,
      });
    }
  }

  const totals = calculateMealTotals(items);
  return { items, totals, unmatched };
}
