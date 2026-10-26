import React, { useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input } from '../common/FormField.jsx';

export default function EditTargetsModal({ isOpen, onClose, currentTargets, onSaveTargets }) {
  const [formData, setFormData] = useState(() => ({
    calories: currentTargets.calories || 2100,
    protein: currentTargets.protein || 110,
    fiber: currentTargets.fiber || 35,
    carbs: currentTargets.carbs || 260,
    fat: currentTargets.fat || 60,
  }));
  const [error, setError] = useState(null);

  const handleChange = (field, val) => {
    setFormData((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const cals = parseInt(formData.calories, 10);
    const pro = parseFloat(formData.protein);
    const fib = parseFloat(formData.fiber);
    const crb = parseFloat(formData.carbs);
    const ft = parseFloat(formData.fat);

    if (isNaN(cals) || cals <= 0 || isNaN(pro) || pro < 0 || isNaN(fib) || fib < 0 || isNaN(crb) || crb < 0 || isNaN(ft) || ft < 0) {
      setError('Please provide valid positive numbers for all daily targets.');
      return;
    }

    onSaveTargets({
      calories: cals,
      protein: Math.round(pro * 10) / 10,
      fiber: Math.round(fib * 10) / 10,
      carbs: Math.round(crb * 10) / 10,
      fat: Math.round(ft * 10) / 10,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🎯 Edit Daily Nutrition Targets">
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: 0 }}>
          Customize your daily macro and energy targets. All progress bars on your Diet page and Dashboard will track against these goals.
        </p>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Daily Calories (kcal)"
            type="number"
            min="500"
            max="6000"
            value={formData.calories}
            onChange={(e) => handleChange('calories', e.target.value)}
            required
          />

          <Input
            label="Daily Protein (grams)"
            type="number"
            min="10"
            max="300"
            value={formData.protein}
            onChange={(e) => handleChange('protein', e.target.value)}
            required
          />

          <Input
            label="Daily Fiber (grams)"
            type="number"
            min="5"
            max="100"
            value={formData.fiber}
            onChange={(e) => handleChange('fiber', e.target.value)}
            required
          />

          <Input
            label="Daily Carbs (grams)"
            type="number"
            min="20"
            max="600"
            value={formData.carbs}
            onChange={(e) => handleChange('carbs', e.target.value)}
            required
          />

          <Input
            label="Daily Fat (grams)"
            type="number"
            min="5"
            max="200"
            value={formData.fat}
            onChange={(e) => handleChange('fat', e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save Targets
          </Button>
        </div>
      </form>
    </Modal>
  );
}
