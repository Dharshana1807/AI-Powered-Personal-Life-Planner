import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import { Input, Select } from '../common/FormField.jsx';
import {
  parseNaturalMeal,
  parseQuantity,
  searchFoodsAutocomplete,
  calculateItemNutrition,
  calculateMealTotals,
} from '../../utils/mealParser.js';
import { saveCustomFood } from '../../utils/nutritionStorage.js';
import { formatTime12h } from '../../utils/dateUtils.js';

export default function LogMealModal({
  isOpen,
  onClose,
  selectedDate,
  mealToEdit = null,
  customFoods = [],
  onSaveMeal,
  onCustomFoodAdded,
}) {
  const [mealType, setMealType] = useState('Breakfast');
  const [mealTime, setMealTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [mealName, setMealName] = useState('');
  const [entryMode, setEntryMode] = useState('natural'); // 'natural' | 'item'

  // Natural language input state
  const [naturalText, setNaturalText] = useState('');
  const [naturalParsed, setNaturalParsed] = useState(null);

  // Item-by-item state
  const [foodQuery, setFoodQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodQuantity, setFoodQuantity] = useState('1');
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Resolved list of meal items
  const [items, setItems] = useState([]);

  // Unmatched food handling state
  const [unmatchedItems, setUnmatchedItems] = useState([]);
  const [manualFoodForm, setManualFoodForm] = useState(null); // active item being manually entered
  const [manualSaveAsCustom, setManualSaveAsCustom] = useState(true);

  // Error & validation message
  const [error, setError] = useState(null);

  const autocompleteRef = useRef(null);

  // Initialize or reset form when modal opens or mealToEdit changes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }

    if (mealToEdit) {
      setMealType(mealToEdit.mealType || 'Breakfast');
      setMealTime(mealToEdit.time || '12:00');
      setMealName(mealToEdit.name || '');
      setItems(Array.isArray(mealToEdit.items) ? [...mealToEdit.items] : []);
      setEntryMode('item');
      setNaturalText('');
      setNaturalParsed(null);
      setUnmatchedItems([]);
    } else {
      resetForm();
    }
  }, [isOpen, mealToEdit]);

  const resetForm = () => {
    const d = new Date();
    setMealType('Breakfast');
    setMealTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setMealName('');
    setEntryMode('natural');
    setNaturalText('');
    setNaturalParsed(null);
    setFoodQuery('');
    setSelectedFood(null);
    setFoodQuantity('1');
    setAutocompleteSuggestions([]);
    setShowDropdown(false);
    setItems([]);
    setUnmatchedItems([]);
    setManualFoodForm(null);
    setError(null);
  };

  // Autocomplete handling for item-by-item mode
  useEffect(() => {
    if (entryMode !== 'item' || !foodQuery.trim() || selectedFood) {
      setAutocompleteSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const matches = searchFoodsAutocomplete(foodQuery, customFoods);
    setAutocompleteSuggestions(matches);
    setShowDropdown(matches.length > 0);
  }, [foodQuery, entryMode, customFoods, selectedFood]);

  // Click outside autocomplete dropdown to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse natural meal text
  const handleParseNatural = () => {
    setError(null);
    if (!naturalText.trim()) {
      setError('Please type one or more foods with quantities, e.g. "2 idli, 1 dosa, 1 cup rice".');
      return;
    }

    const result = parseNaturalMeal(naturalText, customFoods);
    setNaturalParsed(result);

    if (result.items.length > 0) {
      setItems((prev) => [...prev, ...result.items]);
    }

    if (result.unmatched.length > 0) {
      setUnmatchedItems(result.unmatched);
    } else {
      setUnmatchedItems([]);
    }
  };

  // Add item from item-by-item form
  const handleAddItemByItem = (e) => {
    if (e) e.preventDefault();
    setError(null);

    const parsedQty = parseQuantity(foodQuantity);
    if (parsedQty === null || parsedQty <= 0) {
      setError('Please enter a valid positive quantity (e.g. 1, 2, 0.5, or ½).');
      return;
    }

    if (!selectedFood && !foodQuery.trim()) {
      setError('Please choose or enter a food name.');
      return;
    }

    if (selectedFood) {
      const nutrition = calculateItemNutrition(selectedFood, parsedQty);
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        foodId: selectedFood.id,
        foodName: selectedFood.name,
        quantity: parsedQty,
        unit: selectedFood.unit || 'serving',
        servingSize: selectedFood.servingSize,
        ...nutrition,
        matched: true,
        isCustom: Boolean(selectedFood.isCustom),
      };

      setItems((prev) => [...prev, newItem]);
      setSelectedFood(null);
      setFoodQuery('');
      setFoodQuantity('1');
    } else {
      // Try natural parser on the query string entered
      const testResult = parseNaturalMeal(`${foodQuantity} ${foodQuery}`, customFoods);
      if (testResult.items.length > 0) {
        setItems((prev) => [...prev, ...testResult.items]);
        setSelectedFood(null);
        setFoodQuery('');
        setFoodQuantity('1');
      } else {
        // Not found in database
        setUnmatchedItems([
          {
            foodQuery: foodQuery.trim(),
            quantity: parsedQty,
            rawText: `${foodQuantity} ${foodQuery}`,
            suggestions: testResult.unmatched[0]?.suggestions || [],
          },
        ]);
      }
    }
  };

  // Accept alternative suggested food for an unmatched entry
  const handleChooseAlternative = (unmatchedIndex, suggestedFood) => {
    const target = unmatchedItems[unmatchedIndex];
    if (!target) return;

    const nutrition = calculateItemNutrition(suggestedFood, target.quantity);
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      foodId: suggestedFood.id,
      foodName: suggestedFood.name,
      quantity: target.quantity,
      unit: suggestedFood.unit || 'serving',
      servingSize: suggestedFood.servingSize,
      ...nutrition,
      matched: true,
      isCustom: Boolean(suggestedFood.isCustom),
    };

    setItems((prev) => [...prev, newItem]);
    setUnmatchedItems((prev) => prev.filter((_, idx) => idx !== unmatchedIndex));
  };

  // Open manual entry form for unmatched food
  const handleOpenManualForm = (unmatchedIndex) => {
    const target = unmatchedItems[unmatchedIndex];
    if (!target) return;

    setManualFoodForm({
      unmatchedIndex,
      name: target.foodQuery || 'Custom Food',
      quantity: target.quantity || 1,
      unit: 'serving',
      servingSize: '1 serving',
      calories: 150,
      protein: 5,
      fiber: 2,
      carbs: 20,
      fat: 5,
    });
  };

  // Save manual food entry into meal and optionally to custom foods
  const handleSaveManualFood = (e) => {
    e.preventDefault();
    if (!manualFoodForm) return;

    const cals = parseInt(manualFoodForm.calories, 10);
    const pro = parseFloat(manualFoodForm.protein);
    const fib = parseFloat(manualFoodForm.fiber);
    const crb = parseFloat(manualFoodForm.carbs);
    const ft = parseFloat(manualFoodForm.fat);
    const qty = parseFloat(manualFoodForm.quantity) || 1;

    if (isNaN(cals) || cals < 0 || isNaN(pro) || pro < 0 || isNaN(fib) || fib < 0 || isNaN(crb) || crb < 0 || isNaN(ft) || ft < 0) {
      setError('Please provide valid positive numbers for manual nutrition values.');
      return;
    }

    let foodId = `food-custom-${Date.now()}`;
    if (manualSaveAsCustom) {
      const saved = saveCustomFood({
        id: foodId,
        name: manualFoodForm.name,
        unit: manualFoodForm.unit,
        servingSize: manualFoodForm.servingSize,
        calories: cals,
        protein: pro,
        fiber: fib,
        carbs: crb,
        fat: ft,
      });
      if (saved && onCustomFoodAdded) {
        onCustomFoodAdded(saved);
      }
    }

    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      foodId,
      foodName: manualFoodForm.name,
      quantity: qty,
      unit: manualFoodForm.unit,
      servingSize: manualFoodForm.servingSize,
      calories: Math.round(cals * qty),
      protein: Math.round(pro * qty * 10) / 10,
      fiber: Math.round(fib * qty * 10) / 10,
      carbs: Math.round(crb * qty * 10) / 10,
      fat: Math.round(ft * qty * 10) / 10,
      matched: true,
      isCustom: true,
    };

    setItems((prev) => [...prev, newItem]);
    setUnmatchedItems((prev) => prev.filter((_, idx) => idx !== manualFoodForm.unmatchedIndex));
    setManualFoodForm(null);
  };

  // Remove item from meal
  const handleRemoveItem = (itemId) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Adjust quantity of item already added
  const handleUpdateItemQuantity = (itemId, newQty) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const ratio = qty / (it.quantity || 1);
        return {
          ...it,
          quantity: qty,
          calories: Math.round(it.calories * ratio),
          protein: Math.round(it.protein * ratio * 10) / 10,
          fiber: Math.round(it.fiber * ratio * 10) / 10,
          carbs: Math.round(it.carbs * ratio * 10) / 10,
          fat: Math.round(it.fat * ratio * 10) / 10,
        };
      })
    );
  };

  // Calculate live meal totals
  const mealTotals = calculateMealTotals(items);

  // Submit and save meal
  const handleSaveMeal = (e) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError('Please add at least one food item before logging this meal.');
      return;
    }

    if (unmatchedItems.length > 0) {
      setError('You have unresolved items. Please pick an alternative or enter nutrition manually.');
      return;
    }

    const finalName = mealName.trim() || `${mealType} (${formatTime12h(mealTime)})`;

    onSaveMeal({
      id: mealToEdit?.id,
      name: finalName,
      mealType,
      time: mealTime,
      items,
      calories: mealTotals.calories,
      protein: mealTotals.protein,
      fiber: mealTotals.fiber,
      carbs: mealTotals.carbs,
      fat: mealTotals.fat,
      fromPlannedId: mealToEdit?.fromPlannedId || null,
    });

    onClose();
  };

  const mealTypeOptions = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mealToEdit ? '✏️ Edit Consumed Meal' : '🍽️ Log Consumed Meal'}
      maxWidth="680px"
    >
      <form onSubmit={handleSaveMeal} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
            }}
          >
            {error}
          </div>
        )}

        {/* Meal Type & Time Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', display: 'block', marginBottom: '4px' }}>
              MEAL TYPE
            </label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {mealTypeOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: mealType === type ? 'var(--color-primary-active)' : 'var(--color-border)',
                    backgroundColor: mealType === type ? 'var(--color-primary-subtle)' : 'var(--color-bg)',
                    color: mealType === type ? 'var(--color-text)' : 'var(--color-muted-text)',
                    fontWeight: mealType === type ? 700 : 500,
                    fontSize: 'var(--font-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', display: 'block', marginBottom: '4px' }}>
              TIME CONSUMED
            </label>
            <input
              type="time"
              value={mealTime}
              onChange={(e) => setMealTime(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                backgroundColor: 'var(--color-bg)',
              }}
              required
            />
          </div>
        </div>

        {/* Optional Custom Label */}
        <Input
          label="Meal Title (Optional)"
          placeholder="e.g. South Indian Morning Feast, Post-Workout Snack"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          style={{ marginBottom: 0 }}
        />

        {/* Entry Mode Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '2px solid var(--color-border)',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-1)',
          }}
        >
          <button
            type="button"
            onClick={() => setEntryMode('natural')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: entryMode === 'natural' ? '2px solid var(--color-primary-active)' : '2px solid transparent',
              marginBottom: '-2px',
              backgroundColor: 'transparent',
              fontWeight: entryMode === 'natural' ? 800 : 600,
              fontSize: 'var(--font-sm)',
              color: entryMode === 'natural' ? 'var(--color-text)' : 'var(--color-muted-text)',
              cursor: 'pointer',
            }}
          >
            💬 Natural Text Input (e.g. “2 idli, 1 dosa”)
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('item')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: entryMode === 'item' ? '2px solid var(--color-primary-active)' : '2px solid transparent',
              marginBottom: '-2px',
              backgroundColor: 'transparent',
              fontWeight: entryMode === 'item' ? 800 : 600,
              fontSize: 'var(--font-sm)',
              color: entryMode === 'item' ? 'var(--color-text)' : 'var(--color-muted-text)',
              cursor: 'pointer',
            }}
          >
            🔍 Item-by-Item Search & Autocomplete
          </button>
        </div>

        {/* MODE A: NATURAL INPUT */}
        {entryMode === 'natural' && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)' }}>
              TYPE FOODS WITH QUANTITIES IN NATURAL FORM:
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
              <input
                type="text"
                placeholder='e.g. 2 idli, 1 dosa, 1 cup rice, 1 bowl dal'
                value={naturalText}
                onChange={(e) => setNaturalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleParseNatural();
                  }
                }}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  backgroundColor: 'var(--color-bg)',
                }}
              />
              <Button type="button" variant="primary" onClick={handleParseNatural}>
                ⚡ Parse & Add
              </Button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
              Supports numbers (2), fractions (½, 1/2), words (two, one), units (cup, bowl, piece, glass), and aliases (e.g. roti, phulka, chawal).
            </div>
          </div>
        )}

        {/* MODE B: ITEM BY ITEM AUTOCOMPLETE */}
        {entryMode === 'item' && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Autocomplete Input Container */}
              <div ref={autocompleteRef} style={{ flex: 2, minWidth: '220px', position: 'relative' }}>
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', display: 'block', marginBottom: '4px' }}>
                  FOOD NAME / SEARCH
                </label>
                <input
                  type="text"
                  placeholder="Search Indian food (e.g. Idli, Paneer, Dal, Rice)..."
                  value={foodQuery}
                  onChange={(e) => {
                    setFoodQuery(e.target.value);
                    setSelectedFood(null);
                  }}
                  onFocus={() => {
                    if (autocompleteSuggestions.length > 0) setShowDropdown(true);
                  }}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-sm)',
                    backgroundColor: 'var(--color-bg)',
                  }}
                />

                {/* Dropdown Suggestions */}
                {showDropdown && autocompleteSuggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: '4px',
                    }}
                  >
                    {autocompleteSuggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedFood(item);
                          setFoodQuery(item.name);
                          setShowDropdown(false);
                        }}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--color-border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 'var(--font-sm)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', marginLeft: '6px' }}>
                            ({item.servingSize})
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary-active)' }}>
                          ~{item.calories} kcal • {item.protein}g P
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity Field */}
              <div style={{ width: '100px' }}>
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', display: 'block', marginBottom: '4px' }}>
                  QUANTITY
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2, ½"
                  value={foodQuantity}
                  onChange={(e) => setFoodQuantity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-sm)',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-bg)',
                  }}
                />
              </div>

              {/* Add Button */}
              <Button type="button" variant="outline" onClick={handleAddItemByItem}>
                + Add Item
              </Button>
            </div>

            {selectedFood && (
              <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                ✓ Selected: {selectedFood.name} ({selectedFood.servingSize} • {selectedFood.calories} kcal per {selectedFood.unit})
              </div>
            )}
          </div>
        )}

        {/* UNMATCHED FOOD PROMPTS & SUGGESTIONS */}
        {unmatchedItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {unmatchedItems.map((unmatched, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-secondary-subtle)',
                  border: '1px solid var(--color-secondary-accent)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-secondary-accent)' }}>
                    ⚠️ Food not found in database: "{unmatched.foodQuery || unmatched.rawText}"
                  </div>
                  <button
                    type="button"
                    onClick={() => setUnmatchedItems((prev) => prev.filter((_, i) => i !== index))}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>

                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text)' }}>
                  Choose a suggested alternative or enter calories, protein, fiber, carbs, and fat manually:
                </div>

                {/* Suggested Alternatives */}
                {unmatched.suggestions && unmatched.suggestions.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
                      SUGGESTED SIMILAR FOODS:
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {unmatched.suggestions.map((alt) => (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => handleChooseAlternative(index, alt)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-xs)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>{alt.name}</span>
                          <span style={{ color: 'var(--color-muted-text)', fontSize: '10px' }}>({alt.calories} kcal)</span>
                          <span style={{ fontWeight: 800, color: 'var(--color-primary-active)' }}>Use ↵</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Option to Enter Manually */}
                <div>
                  <Button size="sm" variant="outline" type="button" onClick={() => handleOpenManualForm(index)}>
                    ✏️ Enter Nutrition Manually
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MANUAL NUTRITION ENTRY POP-IN FORM */}
        {manualFoodForm && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg)',
              border: '2px solid var(--color-primary-active)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 'var(--font-sm)' }}>
                ✍️ Manual Nutrition Entry for "{manualFoodForm.name}"
              </strong>
              <button
                type="button"
                onClick={() => setManualFoodForm(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--space-2)' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)' }}>FOOD NAME</label>
                <input
                  type="text"
                  value={manualFoodForm.name}
                  onChange={(e) => setManualFoodForm({ ...manualFoodForm, name: e.target.value })}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)' }}>CALORIES (kcal)</label>
                <input
                  type="number"
                  min="0"
                  value={manualFoodForm.calories}
                  onChange={(e) => setManualFoodForm({ ...manualFoodForm, calories: e.target.value })}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)' }}>PROTEIN (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={manualFoodForm.protein}
                  onChange={(e) => setManualFoodForm({ ...manualFoodForm, protein: e.target.value })}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)' }}>FIBER (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={manualFoodForm.fiber}
                  onChange={(e) => setManualFoodForm({ ...manualFoodForm, fiber: e.target.value })}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)' }}>CARBS (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={manualFoodForm.carbs}
                  onChange={(e) => setManualFoodForm({ ...manualFoodForm, carbs: e.target.value })}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)' }}>FAT (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={manualFoodForm.fat}
                  onChange={(e) => setManualFoodForm({ ...manualFoodForm, fat: e.target.value })}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="checkbox"
                id="save-as-custom-checkbox"
                checked={manualSaveAsCustom}
                onChange={(e) => setManualSaveAsCustom(e.target.checked)}
              />
              <label htmlFor="save-as-custom-checkbox" style={{ fontSize: 'var(--font-xs)', cursor: 'pointer' }}>
                Save to Custom Foods library for future autocomplete & logging
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button size="sm" variant="outline" type="button" onClick={() => setManualFoodForm(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="button" onClick={handleSaveManualFood}>
                ✓ Add to Meal
              </Button>
            </div>
          </div>
        )}

        {/* PER-ITEM BREAKDOWN TABLE */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
              ITEMS IN THIS MEAL ({items.length})
            </span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setItems([])}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', fontSize: 'var(--font-xs)', cursor: 'pointer' }}
              >
                Clear All
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-4)',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-muted-text)',
                fontSize: 'var(--font-sm)',
              }}
            >
              No items added yet. Type your foods above or pick from search.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '200px', overflowY: 'auto' }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>
                      {it.foodName}
                      {it.isCustom && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: 'var(--color-secondary-subtle)', color: 'var(--color-secondary-accent)', padding: '2px 4px', borderRadius: '3px' }}>
                          Custom
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                      ⚡ {it.calories} kcal • 🍗 {it.protein}g P • 🌱 {it.fiber}g Fib • 🍚 {it.carbs}g C • 🥑 {it.fat}g F
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.25"
                      min="0.1"
                      value={it.quantity}
                      onChange={(e) => handleUpdateItemQuantity(it.id, e.target.value)}
                      style={{
                        width: '60px',
                        padding: '4px',
                        textAlign: 'center',
                        fontSize: 'var(--font-xs)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                      }}
                      title="Adjust quantity"
                    />
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', minWidth: '40px' }}>
                      {it.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        fontSize: '15px',
                        padding: '0 4px',
                      }}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MEAL TOTALS SUMMARY BANNER */}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-primary-subtle)',
            border: '1px solid var(--color-primary-active)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase' }}>
            MEAL TOTAL NUTRITION:
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
            <span>⚡ {mealTotals.calories} kcal</span>
            <span>🍗 {mealTotals.protein}g Protein</span>
            <span>🌱 {mealTotals.fiber}g Fiber</span>
            <span>🍚 {mealTotals.carbs}g Carbs</span>
            <span>🥑 {mealTotals.fat}g Fat</span>
          </div>
        </div>

        {/* MODAL ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {mealToEdit ? '✓ Update Meal' : '✓ Save Logged Meal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
