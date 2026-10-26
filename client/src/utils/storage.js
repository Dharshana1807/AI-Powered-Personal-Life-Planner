/**
 * Storage Utility for Adaptive AI Planner
 * Key: adaptive_planner_data_v1
 * Schema Version: 1
 * Strictly wraps all localStorage accesses in try/catch and provides schema migration.
 */

export const STORAGE_KEY = 'adaptive_planner_data_v1';
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Creates an empty initial state with schema version.
 */
export function createInitialState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    plans: {},
  };
}

/**
 * Safely migrates raw data from older versions (v1, v2) into schema version 3.
 * Populates task.date from plan.date and ensures all canonical task fields are present.
 * @param {any} raw
 * @returns {{ schemaVersion: number, plans: Record<string, object> }}
 */
export function migrateData(raw) {
  if (!raw || typeof raw !== 'object') {
    return createInitialState();
  }

  const migrated = createInitialState();

  const normalizeTask = (t, planDate) => ({
    id: t.id,
    date: t.date || planDate,
    name: t.name || 'Untitled Task',
    category: t.category || 'Education',
    durationMinutes: Number(t.durationMinutes) || 30,
    priority: t.priority || 'Medium',
    preferredTime: t.preferredTime ?? null,
    scheduledStart: t.scheduledStart ?? null,
    scheduledEnd: t.scheduledEnd ?? null,
    status: t.status || 'pending',
    notes: t.notes || '',
    deadlineDate: t.deadlineDate ?? null,
    deadlineTime: t.deadlineTime ?? null,
    updatedAt: t.updatedAt || new Date().toISOString(),
    completedAt: t.completedAt ?? null,
    skippedAt: t.skippedAt ?? null,
    movedFrom: t.movedFrom ?? null,
  });

  // If raw has a plans map
  if (raw.plans && typeof raw.plans === 'object') {
    for (const [dateKey, planObj] of Object.entries(raw.plans)) {
      if (planObj && typeof planObj === 'object') {
        const planDate = planObj.date || dateKey;
        migrated.plans[dateKey] = {
          ...planObj,
          date: planDate,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          schedule: planObj.schedule ?? null,
          tasks: Array.isArray(planObj.tasks)
            ? planObj.tasks.map((t) => normalizeTask(t, planDate))
            : [],
        };
      }
    }
  } else if (raw.date && raw.userType) {
    // If raw was a single un-keyed legacy plan object
    const planDate = raw.date;
    migrated.plans[planDate] = {
      ...raw,
      date: planDate,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      schedule: raw.schedule ?? null,
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks.map((t) => normalizeTask(t, planDate))
        : [],
    };
  }

  return migrated;
}

/**
 * Loads and returns all stored state from localStorage.
 * @returns {{ state: object, error: string | null }}
 */
export function loadStoredState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { state: createInitialState(), error: 'localStorage is not available in this environment.' };
  }

  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return { state: createInitialState(), error: null };
    }
    const parsed = JSON.parse(serialized);
    const migrated = migrateData(parsed);
    return { state: migrated, error: null };
  } catch (err) {
    console.error('Error loading plans from localStorage:', err);
    return {
      state: createInitialState(),
      error: `Could not load saved plans: ${err.message || 'Corrupted data format.'}`,
    };
  }
}

/**
 * Saves the full state into localStorage.
 * @param {object} state
 * @returns {{ success: boolean, error: string | null }}
 */
export function saveStoredState(state) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'localStorage is not available in this environment.' };
  }

  try {
    const payload = {
      ...state,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { success: true, error: null };
  } catch (err) {
    console.error('Error saving plans to localStorage:', err);
    const isQuota =
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014;
    return {
      success: false,
      error: isQuota
        ? 'Browser storage is full. Please remove older plans to save new ones.'
        : `Could not save plan to storage: ${err.message}`,
    };
  }
}

/**
 * Retrieves a plan for a specific date (YYYY-MM-DD).
 * @param {string} date
 * @returns {object | null}
 */
export function getPlanForDate(date) {
  const { state } = loadStoredState();
  return state.plans[date] || null;
}

/**
 * Saves a plan for a specific date without mutating other dates.
 * @param {string} date
 * @param {object} planData
 * @returns {{ success: boolean, error: string | null }}
 */
export function savePlanForDate(date, planData) {
  const { state, error: loadErr } = loadStoredState();
  if (loadErr && Object.keys(state.plans).length === 0) {
    // If reading failed, still attempt to set
  }

  const updatedPlans = {
    ...state.plans,
    [date]: {
      ...planData,
      date,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      createdAt: planData.createdAt || new Date().toISOString(),
    },
  };

  return saveStoredState({ ...state, plans: updatedPlans });
}

/**
 * Deletes a plan for a specific date.
 * @param {string} date
 * @returns {{ success: boolean, error: string | null }}
 */
export function deletePlanForDate(date) {
  const { state } = loadStoredState();
  const nextPlans = { ...state.plans };
  delete nextPlans[date];
  return saveStoredState({ ...state, plans: nextPlans });
}

// =====================================================
// JOURNAL PERSISTENCE HELPERS
// Key: adaptive_planner_journal_v1
// Kept strictly client-side in localStorage (never sent to any server/AI)
// =====================================================

export const JOURNAL_STORAGE_KEY = 'adaptive_planner_journal_v1';

/**
 * Loads all journal entries from localStorage, sorted newest first.
 * @returns {Array<{ id: string, date: string, title: string, content: string, createdAt: string, updatedAt: string }>}
 */
export function loadJournalEntries() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => {
      const cmpDate = (b.date || '').localeCompare(a.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  } catch (err) {
    console.error('Failed to load journal entries from storage:', err);
    return [];
  }
}

/**
 * Saves all journal entries to localStorage.
 * @param {Array<object>} entries
 * @returns {{ success: boolean, error: string | null }}
 */
export function saveJournalEntries(entries) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'localStorage is not available in this environment.' };
  }
  try {
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
    return { success: true, error: null };
  } catch (err) {
    console.error('Error saving journal entries to localStorage:', err);
    const isQuota =
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014;
    return {
      success: false,
      error: isQuota
        ? 'Browser storage is full. Please delete older journal entries to save new ones.'
        : `Could not save journal entry: ${err.message}`,
    };
  }
}

/**
 * Finds a journal entry by its date (YYYY-MM-DD).
 * @param {string} date
 * @returns {object | null}
 */
export function getJournalEntryByDate(date) {
  const entries = loadJournalEntries();
  return entries.find((e) => e.date === date) || null;
}

/**
 * Deletes a journal entry by its id.
 * @param {string} id
 * @returns {{ success: boolean, error: string | null }}
 */
export function deleteJournalEntry(id) {
  const entries = loadJournalEntries();
  const filtered = entries.filter((e) => e.id !== id);
  return saveJournalEntries(filtered);
}

// =====================================================
// REGULAR ROUTINE PERSISTENCE HELPERS
// Key: adaptive_planner_routine_v1
// Users define wake-up time, college/work, travel, meals, bedtime once
// and reuse this saved routine when creating daily plans.
// =====================================================

export const ROUTINE_STORAGE_KEY = 'adaptive_planner_routine_v1';

export function getDefaultRoutine() {
  return {
    userType: 'student',
    wakeTime: '07:00',
    bedTime: '23:00',
    workHours: {
      enabled: true,
      start: '09:00',
      end: '17:00',
      label: 'College / Classes',
    },
    travel: {
      enabled: false,
      start: '08:30',
      end: '09:00',
      label: 'Commute / Travel',
    },
    travelMinutes: 0,
    meals: [
      { id: 'meal_breakfast', name: 'Breakfast', start: '08:00', end: '08:30' },
      { id: 'meal_lunch', name: 'Lunch', start: '13:00', end: '13:45' },
      { id: 'meal_dinner', name: 'Dinner', start: '20:00', end: '20:45' },
    ],
    commitments: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadSavedRoutine() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultRoutine();
  }
  try {
    const raw = window.localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (!raw) return getDefaultRoutine();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultRoutine();
    return {
      ...getDefaultRoutine(),
      ...parsed,
      workHours: parsed.workHours ? { ...getDefaultRoutine().workHours, ...parsed.workHours } : null,
      travel: parsed.travel ? { ...getDefaultRoutine().travel, ...parsed.travel } : null,
      meals: Array.isArray(parsed.meals) ? parsed.meals : getDefaultRoutine().meals,
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
    };
  } catch (err) {
    console.error('Failed to load saved routine:', err);
    return getDefaultRoutine();
  }
}

export function saveSavedRoutine(routine) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'localStorage is not available.' };
  }
  try {
    const payload = {
      ...routine,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(payload));
    return { success: true, error: null };
  } catch (err) {
    console.error('Failed to save routine:', err);
    return { success: false, error: err.message };
  }
}

export function hasSavedRoutine() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return Boolean(window.localStorage.getItem(ROUTINE_STORAGE_KEY));
}

// =====================================================
// SIMPLIFIED GOAL TRACKING CHECKLISTS HELPERS
// Key: adaptive_planner_goals_v1
// Four independent categories: Diet, Fitness, Career, Education.
// Tasks have only title + circular completion checkbox + optional delete.
// =====================================================

export const GOAL_CHECKLISTS_STORAGE_KEY = 'adaptive_planner_goals_v1';

export function getDefaultGoalChecklists() {
  return {
    diet: [],
    fitness: [],
    career: [],
    education: [],
  };
}

export function loadGoalChecklists() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultGoalChecklists();
  }
  try {
    const raw = window.localStorage.getItem(GOAL_CHECKLISTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          diet: Array.isArray(parsed.diet) ? parsed.diet : [],
          fitness: Array.isArray(parsed.fitness) ? parsed.fitness : [],
          career: Array.isArray(parsed.career) ? parsed.career : [],
          education: Array.isArray(parsed.education) ? parsed.education : [],
        };
      }
    }

    // Migration fallback: populate from any existing plan tasks matching categories
    const initial = getDefaultGoalChecklists();
    const { state } = loadStoredState();
    if (state && state.plans) {
      Object.values(state.plans).forEach((plan) => {
        if (Array.isArray(plan.tasks)) {
          plan.tasks.forEach((t) => {
            const cat = (t.category || '').toLowerCase();
            if (['diet', 'fitness', 'career', 'education'].includes(cat)) {
              if (!initial[cat].some((item) => item.title.toLowerCase() === t.name.toLowerCase())) {
                initial[cat].push({
                  id: t.id || `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  title: t.name,
                  completed: t.status === 'completed',
                  createdAt: t.updatedAt || new Date().toISOString(),
                  updatedAt: t.updatedAt || new Date().toISOString(),
                });
              }
            }
          });
        }
      });
      saveGoalChecklists(initial);
    }
    return initial;
  } catch (err) {
    console.error('Failed to load goal checklists:', err);
    return getDefaultGoalChecklists();
  }
}

export function saveGoalChecklists(checklists) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'localStorage is not available.' };
  }
  try {
    window.localStorage.setItem(GOAL_CHECKLISTS_STORAGE_KEY, JSON.stringify(checklists));
    return { success: true, error: null };
  } catch (err) {
    console.error('Failed to save goal checklists:', err);
    return { success: false, error: err.message };
  }
}

export function addGoalChecklistItem(category, title) {
  const checklists = loadGoalChecklists();
  const cat = (category || 'fitness').toLowerCase();
  if (!checklists[cat]) checklists[cat] = [];

  const newItem = {
    id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  checklists[cat].push(newItem);
  saveGoalChecklists(checklists);
  return { success: true, item: newItem, checklists };
}

export function toggleGoalChecklistItem(category, taskId) {
  const checklists = loadGoalChecklists();
  const cat = (category || 'fitness').toLowerCase();
  if (!checklists[cat]) return { success: false, error: 'Category not found' };

  let updatedItem = null;
  checklists[cat] = checklists[cat].map((item) => {
    if (item.id === taskId) {
      updatedItem = {
        ...item,
        completed: !item.completed,
        updatedAt: new Date().toISOString(),
      };
      return updatedItem;
    }
    return item;
  });

  saveGoalChecklists(checklists);
  return { success: true, item: updatedItem, checklists };
}

export function deleteGoalChecklistItem(category, taskId) {
  const checklists = loadGoalChecklists();
  const cat = (category || 'fitness').toLowerCase();
  if (!checklists[cat]) return { success: false, error: 'Category not found' };

  checklists[cat] = checklists[cat].filter((item) => item.id !== taskId);
  saveGoalChecklists(checklists);
  return { success: true, checklists };
}

// =====================================================
// GUIDED REGENERATION SAVED PREFERENCES HELPERS
// Key: adaptive_planner_chat_prefs_v1
// Remembers preferences only when user explicitly asks to save them permanently
// =====================================================

export const CHAT_PREFS_STORAGE_KEY = 'adaptive_planner_chat_prefs_v1';

export function loadChatPreferences() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CHAT_PREFS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

export function saveChatPreferences(prefs) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(CHAT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch (err) {
    return false;
  }
}

// =====================================================
// UNIFIED MASTER STORE (SCHEMA V4) - SINGLE SOURCE OF TRUTH
// Integrates Plans, Routine, Goals, Study, Career, Nutrition,
// Fitness, Habits, Focus, Journal, Reminders, Settings, and History.
// =====================================================

export const STUDY_STORAGE_KEY = 'adaptive_planner_study_v1';
export const CAREER_STORAGE_KEY = 'adaptive_planner_career_v1';
export const NUTRITION_STORAGE_KEY = 'adaptive_planner_nutrition_v1';
export const FITNESS_STORAGE_KEY = 'adaptive_planner_fitness_v1';
export const HABITS_STORAGE_KEY = 'adaptive_planner_habits_v1';
export const FOCUS_STORAGE_KEY = 'adaptive_planner_focus_v1';
export const SETTINGS_STORAGE_KEY = 'adaptive_planner_settings_v1';
export const HISTORY_STORAGE_KEY = 'adaptive_planner_history_v1';

export function getDefaultStudyData() {
  return {
    subjects: [
      { id: 'sub-1', name: 'Operating Systems', examDate: '2026-11-15', notes: 'Chapters 1-7' },
      { id: 'sub-2', name: 'Computer Networks', examDate: '2026-11-20', notes: 'TCP/IP, Routing' },
    ],
    topics: [
      { id: 'top-1', subjectId: 'sub-1', name: 'Process Synchronization & Semaphores', completed: true },
      { id: 'top-2', subjectId: 'sub-1', name: 'Virtual Memory & Page Replacement', completed: false },
      { id: 'top-3', subjectId: 'sub-2', name: 'Subnetting & CIDR', completed: true },
    ],
    assignments: [
      { id: 'asgn-1', title: 'Network Packet Analyzer Lab', subjectId: 'sub-2', deadlineDate: '2026-10-30', priority: 'High', completed: false },
    ],
    sessions: [],
  };
}

export function getDefaultCareerData() {
  return {
    targetRoles: [
      { id: 'role-1', title: 'Cloud Support Engineer / DevOps Intern', description: 'AWS, Linux, Networking, Scripting' },
    ],
    skills: [
      { id: 'sk-1', name: 'Linux System Administration', category: 'Core', learned: true, targetRole: 'role-1' },
      { id: 'sk-2', name: 'AWS Cloud Fundamentals (EC2/S3/IAM)', category: 'Cloud', learned: true, targetRole: 'role-1' },
      { id: 'sk-3', name: 'Docker & Containerization', category: 'DevOps', learned: false, targetRole: 'role-1' },
      { id: 'sk-4', name: 'Technical English Interview Speaking', category: 'Communication', learned: false, targetRole: 'role-1' },
    ],
    milestones: [
      { id: 'm-1', title: 'Earn AWS Certified Cloud Practitioner', deadlineDate: '2026-11-30', completed: false },
      { id: 'm-2', title: 'Deploy Containerized Full-Stack Portfolio App', deadlineDate: '2026-12-15', completed: false },
    ],
    jobApplications: [
      { id: 'job-1', company: 'CloudScale Technologies', role: 'Support Engineer Trainee', status: 'applied', appliedDate: '2026-10-18', notes: 'Applied via company portal' },
    ],
  };
}

export function getDefaultNutritionData() {
  return {
    targets: { calories: 2100, protein: 110, fiber: 35 },
    recipes: [
      {
        id: 'rec-1',
        name: 'High-Protein Paneer & Sprout Salad',
        mealType: 'Lunch',
        prepTimeMinutes: 15,
        servings: 1,
        calories: 380,
        protein: 28,
        fiber: 9,
        isVegetarian: true,
        ingredients: ['100g low-fat paneer (cubed)', '1 cup sprouted moong', '1 cucumber (diced)', '1 tomato', 'Lemon & chaat masala'],
        instructions: 'Mix sprouted beans, paneer, and diced vegetables. Squeeze fresh lemon juice, add chaat masala and salt. Toss well.',
      },
      {
        id: 'rec-2',
        name: 'Oats & Roasted Peanut Energy Bowl',
        mealType: 'Breakfast',
        prepTimeMinutes: 10,
        servings: 1,
        calories: 420,
        protein: 22,
        fiber: 11,
        isVegetarian: true,
        ingredients: ['60g rolled oats', '1 cup soy/dairy milk', '2 tbsp roasted peanuts', '1 tbsp chia seeds', '1 small banana'],
        instructions: 'Cook oats in warm milk for 5 mins. Top with sliced banana, crunchy peanuts, and chia seeds.',
      },
    ],
    mealPlan: {}, // [date]: { breakfast, morningSnack, lunch, eveningSnack, dinner }
    eatenLog: {}, // [date]: Array<{ id, name, mealType, calories, protein, fiber, eatenAt, confirmed: true }>
  };
}

export function getDefaultFitnessData() {
  return {
    plans: [
      {
        id: 'fit-plan-1',
        name: 'Daily Mobility & Bodyweight Routine',
        frequency: 'Daily (25 mins)',
        exercises: [
          { name: 'Warmup Dynamic Stretches', durationMinutes: 5 },
          { name: 'Bodyweight Squats & Lunges', durationMinutes: 8 },
          { name: 'Push-ups & Incline Variations', durationMinutes: 7 },
          { name: 'Core Planks & Cooldown', durationMinutes: 5 },
        ],
      },
    ],
    logs: [], // Array<{ id, date, planName, durationMinutes, completed: boolean, notes }>
  };
}

export function getDefaultHabitsData() {
  return {
    items: [
      { id: 'hab-1', name: 'Drink 3L Water Throughout the Day', frequency: 'Daily', preferredTime: '08:00', createdAt: '2026-10-01' },
      { id: 'hab-2', name: 'Read 20 mins Technical Docs / Book', frequency: 'Daily', preferredTime: '21:00', createdAt: '2026-10-01' },
      { id: 'hab-3', name: '10 Mins English Speaking Practice', frequency: 'Daily', preferredTime: '17:00', createdAt: '2026-10-01' },
      { id: 'hab-4', name: 'Night Reflection & Daily Review', frequency: 'Daily', preferredTime: '22:30', createdAt: '2026-10-01' },
    ],
    history: {}, // [habitId]: { [date]: boolean }
  };
}

export function getDefaultFocusData() {
  return {
    sessions: [], // Array<{ id, date, taskName, durationMinutes, completedTask: boolean, createdAt }>
  };
}

export function getDefaultSettings() {
  return {
    userName: 'Student Planner',
    userRole: 'CS Student & Aspiring Cloud Engineer',
    timeFormat: '12h',
    theme: 'light',
    quietHours: { enabled: true, start: '22:00', end: '07:00' },
    reminders: { tasks: true, deadlines: true, habits: true, meals: false, milestones: true },
  };
}

const memoryFallbackStore = new Map();

function loadSafeKey(key, fallbackFn) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallbackFn();
    } catch (err) {
      return fallbackFn();
    }
  }
  return memoryFallbackStore.has(key)
    ? JSON.parse(JSON.stringify(memoryFallbackStore.get(key)))
    : fallbackFn();
}

function saveSafeKey(key, data) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }
  memoryFallbackStore.set(key, JSON.parse(JSON.stringify(data)));
  return true;
}

// Module-specific getters & setters
export const loadStudyData = () => loadSafeKey(STUDY_STORAGE_KEY, getDefaultStudyData);
export const saveStudyData = (data) => saveSafeKey(STUDY_STORAGE_KEY, data);

export const loadCareerData = () => loadSafeKey(CAREER_STORAGE_KEY, getDefaultCareerData);
export const saveCareerData = (data) => saveSafeKey(CAREER_STORAGE_KEY, data);

export const loadNutritionData = () => loadSafeKey(NUTRITION_STORAGE_KEY, getDefaultNutritionData);
export const saveNutritionData = (data) => saveSafeKey(NUTRITION_STORAGE_KEY, data);

export const loadFitnessData = () => loadSafeKey(FITNESS_STORAGE_KEY, getDefaultFitnessData);
export const saveFitnessData = (data) => saveSafeKey(FITNESS_STORAGE_KEY, data);

export const loadHabitsData = () => loadSafeKey(HABITS_STORAGE_KEY, getDefaultHabitsData);
export const saveHabitsData = (data) => saveSafeKey(HABITS_STORAGE_KEY, data);

export const loadFocusData = () => loadSafeKey(FOCUS_STORAGE_KEY, getDefaultFocusData);
export const saveFocusData = (data) => saveSafeKey(FOCUS_STORAGE_KEY, data);

export const loadAppSettings = () => loadSafeKey(SETTINGS_STORAGE_KEY, getDefaultSettings);
export const saveAppSettings = (data) => saveSafeKey(SETTINGS_STORAGE_KEY, data);

export const loadChangeHistory = () => loadSafeKey(HISTORY_STORAGE_KEY, () => []);
export const saveChangeHistory = (history) => saveSafeKey(HISTORY_STORAGE_KEY, history);

/**
 * Appends a schedule or data change event to the audit history.
 */
export function recordChangeEvent({ action, summary, author = 'user', date = new Date().toISOString() }) {
  const history = loadChangeHistory();
  const entry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action,
    summary,
    author,
    timestamp: date,
  };
  history.unshift(entry);
  if (history.length > 100) history.pop(); // keep last 100 events
  saveChangeHistory(history);
  return entry;
}

export const SCHEDULE_VERSIONS_STORAGE_KEY = 'adaptive_planner_schedule_versions_v1';
export const loadScheduleVersions = () => loadSafeKey(SCHEDULE_VERSIONS_STORAGE_KEY, () => []);
export const saveScheduleVersions = (versions) => saveSafeKey(SCHEDULE_VERSIONS_STORAGE_KEY, versions);

/**
 * Appends a schedule version snapshot to allow restoring earlier timetable states.
 * Preserves completed task records and protects data integrity.
 */
export function recordScheduleVersion({
  date,
  author = 'User',
  action = 'Manual Edit',
  summary = '',
  plan,
  proposalApplied = false,
}) {
  if (!date || !plan) return null;
  const versions = loadScheduleVersions();
  const entry = {
    id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    date,
    timestamp: new Date().toISOString(),
    author, // 'User' | 'Gemini AI'
    action, // 'Manual Edit' | 'AI Proposal Applied' | 'Regenerated'
    summary: summary || `${action} for ${date}`,
    proposalApplied: Boolean(proposalApplied),
    tasksCount: (plan.tasks || []).length,
    planSnapshot: {
      date: plan.date || date,
      wakeTime: plan.wakeTime,
      bedTime: plan.bedTime,
      status: plan.status,
      tasks: (plan.tasks || []).map((t) => ({ ...t })),
      schedule: plan.schedule ? JSON.parse(JSON.stringify(plan.schedule)) : null,
    },
  };
  versions.unshift(entry);
  if (versions.length > 50) versions.pop();
  saveScheduleVersions(versions);

  // Also record in audit change history
  recordChangeEvent({
    action,
    summary: summary || `${action} (${(plan.tasks || []).length} tasks)`,
    author,
    date: entry.timestamp,
  });

  return entry;
}

/**
 * Restores an earlier schedule version without erasing completed task records or unrelated data.
 */
export function restoreScheduleVersion(versionId, currentPlans = {}) {
  const versions = loadScheduleVersions();
  const targetVersion = versions.find((v) => v.id === versionId);
  if (!targetVersion || !targetVersion.planSnapshot) {
    return { success: false, error: 'Schedule version not found in history.' };
  }
  const snapshot = targetVersion.planSnapshot;
  const targetDate = snapshot.date;
  const existingPlan = currentPlans[targetDate] || {};

  // Preserve completion status and timestamps of already-completed tasks
  const completedTaskMap = new Map();
  (existingPlan.tasks || []).forEach((t) => {
    if (t.status === 'completed') {
      completedTaskMap.set(t.id, t.completedAt || new Date().toISOString());
    }
  });

  const restoredTasks = (snapshot.tasks || []).map((t) => {
    if (completedTaskMap.has(t.id)) {
      return {
        ...t,
        status: 'completed',
        completedAt: completedTaskMap.get(t.id),
      };
    }
    return { ...t };
  });

  const restoredPlan = {
    ...existingPlan,
    ...snapshot,
    date: targetDate,
    tasks: restoredTasks,
    updatedAt: new Date().toISOString(),
  };

  recordChangeEvent({
    action: 'Schedule Restored',
    summary: `Restored version from ${new Date(targetVersion.timestamp).toLocaleTimeString()} (${targetVersion.action})`,
    author: 'User',
  });

  return {
    success: true,
    targetDate,
    restoredPlan,
    version: targetVersion,
  };
}

/**
 * Gathers upcoming reminders from saved records (study deadlines, assignments, career milestones, habits, planned meals).
 */
export function getUpcomingReminders(targetDate, nowTimeStr = '00:00') {
  const reminders = [];
  const settings = loadAppSettings();
  const reminderPrefs = settings.reminders || {};

  // 1. Study assignments & exams
  if (reminderPrefs.deadlines !== false) {
    const study = loadStudyData();
    (study.assignments || []).forEach((asgn) => {
      if (!asgn.completed) {
        reminders.push({
          id: `rem_asgn_${asgn.id}`,
          type: 'assignment',
          category: 'Education',
          title: asgn.title,
          date: asgn.deadlineDate || targetDate,
          time: asgn.deadlineTime || '23:59',
          priority: asgn.priority || 'High',
          icon: '📚',
          sourceUrl: '#/study',
        });
      }
    });

    (study.subjects || []).forEach((sub) => {
      if (sub.examDate) {
        reminders.push({
          id: `rem_exam_${sub.id}`,
          type: 'exam',
          category: 'Education',
          title: `${sub.name} Exam`,
          date: sub.examDate,
          time: '09:00',
          priority: 'High',
          icon: '🎓',
          sourceUrl: '#/study',
        });
      }
    });
  }

  // 2. Career milestones
  if (reminderPrefs.milestones !== false) {
    const career = loadCareerData();
    (career.milestones || []).forEach((ms) => {
      if (!ms.completed) {
        reminders.push({
          id: `rem_ms_${ms.id}`,
          type: 'milestone',
          category: 'Career',
          title: ms.title,
          date: ms.deadlineDate || targetDate,
          time: '18:00',
          priority: 'Medium',
          icon: '💼',
          sourceUrl: '#/career',
        });
      }
    });
  }

  // 3. Daily Habits
  if (reminderPrefs.habits !== false) {
    const habits = loadHabitsData();
    (habits.items || []).forEach((hab) => {
      const isDone = habits.history?.[hab.id]?.[targetDate];
      if (!isDone) {
        reminders.push({
          id: `rem_hab_${hab.id}`,
          type: 'habit',
          category: 'Wellness',
          title: hab.name,
          date: targetDate,
          time: hab.preferredTime || '12:00',
          priority: 'Normal',
          icon: '⚡',
          sourceUrl: '#/habits',
        });
      }
    });
  }

  // 4. Planned Meals
  if (reminderPrefs.meals) {
    const routine = loadSavedRoutine();
    (routine.meals || []).forEach((meal, idx) => {
      reminders.push({
        id: `rem_meal_${idx}`,
        type: 'meal',
        category: 'Nutrition',
        title: `${meal.name || 'Meal'}`,
        date: targetDate,
        time: meal.start || '12:30',
        priority: 'Normal',
        icon: '🥗',
        sourceUrl: '#/nutrition',
      });
    });
  }

  // Sort chronologically by date then time
  reminders.sort((a, b) => {
    if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
    return (a.time || '').localeCompare(b.time || '');
  });

  return reminders;
}

/**
 * Returns the entire single source of truth (Unified Master Store).
 */
export function getUnifiedStore() {
  const { state: plansState } = loadStoredState();
  return {
    schemaVersion: 4,
    plans: plansState.plans || {},
    routine: loadSavedRoutine(),
    goals: loadGoalChecklists(),
    journal: loadJournalEntries(),
    study: loadStudyData(),
    career: loadCareerData(),
    nutrition: loadNutritionData(),
    fitness: loadFitnessData(),
    habits: loadHabitsData(),
    focus: loadFocusData(),
    settings: loadAppSettings(),
    history: loadChangeHistory(),
    chatPreferences: loadChatPreferences(),
  };
}

/**
 * Creates an exportable JSON payload of all user data (excluding API keys and private tokens).
 */
export function exportFullBackup() {
  const store = getUnifiedStore();
  return JSON.stringify(
    {
      appName: 'Adaptive AI Life Planner',
      exportTimestamp: new Date().toISOString(),
      schemaVersion: 4,
      ...store,
    },
    null,
    2
  );
}

/**
 * Restores entire app data from a validated JSON backup string without erasing history.
 */
export function restoreFromBackup(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Backup content is empty.' };
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid backup JSON file structure.' };
    }

    if (parsed.plans) saveStoredState({ schemaVersion: CURRENT_SCHEMA_VERSION, plans: parsed.plans });
    if (parsed.routine) saveSavedRoutine(parsed.routine);
    if (parsed.goals) saveGoalChecklists(parsed.goals);
    if (parsed.journal) saveJournalEntries(parsed.journal);
    if (parsed.study) saveStudyData(parsed.study);
    if (parsed.career) saveCareerData(parsed.career);
    if (parsed.nutrition) saveNutritionData(parsed.nutrition);
    if (parsed.fitness) saveFitnessData(parsed.fitness);
    if (parsed.habits) saveHabitsData(parsed.habits);
    if (parsed.focus) saveFocusData(parsed.focus);
    if (parsed.settings) saveAppSettings(parsed.settings);
    if (parsed.history) saveChangeHistory(parsed.history);

    recordChangeEvent({ action: 'RESTORE_BACKUP', summary: 'Restored data from backup archive.' });
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to restore backup: ${err.message}` };
  }
}

/**
 * Clears all user data back to defaults with confirmation.
 */
export function resetAllData() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const keys = [
    STORAGE_KEY,
    ROUTINE_STORAGE_KEY,
    GOAL_CHECKLISTS_STORAGE_KEY,
    JOURNAL_STORAGE_KEY,
    STUDY_STORAGE_KEY,
    CAREER_STORAGE_KEY,
    NUTRITION_STORAGE_KEY,
    FITNESS_STORAGE_KEY,
    HABITS_STORAGE_KEY,
    FOCUS_STORAGE_KEY,
    SETTINGS_STORAGE_KEY,
    HISTORY_STORAGE_KEY,
    CHAT_PREFS_STORAGE_KEY,
  ];
  keys.forEach((k) => window.localStorage.removeItem(k));
}



