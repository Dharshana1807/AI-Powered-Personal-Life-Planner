import React, { useState, useRef, useEffect } from 'react';
import {
  format12Hour,
  to24Hour,
  parseTo12HourComponents,
} from '../../utils/dateUtils.js';
import { Label } from './FormField.jsx';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// Common planning minutes with full 0-59 range available
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

/**
 * Reusable wheel-style TimePicker.
 * 3 columns: Hour (1-12), Minute (00-59), AM/PM.
 * Touch swipeable, mouse-wheel scrollable, click-to-select, keyboard operable.
 * Always displays 12-hour format ("1:00 AM", "4:30 PM", "9:00 PM").
 * Stores value as standard "HH:mm" 24-hour string.
 */
export default function TimePicker({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = 'Select time...',
  error,
  disabled = false,
  required = false,
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current 24h string into 12h parts
  const parsed = parseTo12HourComponents(value || '09:00');
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(parsed.period);

  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);
  const periodListRef = useRef(null);

  // Sync internal state when external value changes
  useEffect(() => {
    if (value && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
      const p = parseTo12HourComponents(value);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
      setSelectedPeriod(p.period);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto-scroll columns into view when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToActive(hourListRef.current, selectedHour);
        scrollToActive(minuteListRef.current, selectedMinute);
        scrollToActive(periodListRef.current, selectedPeriod);
      }, 50);
    }
  }, [isOpen]);

  const scrollToActive = (container, val) => {
    if (!container) return;
    const activeEl = container.querySelector(`[data-val="${val}"]`);
    if (activeEl) {
      const containerHeight = container.clientHeight;
      const elTop = activeEl.offsetTop;
      const elHeight = activeEl.clientHeight;
      container.scrollTo({
        top: elTop - containerHeight / 2 + elHeight / 2,
        behavior: 'smooth',
      });
    }
  };

  const handleConfirm = () => {
    const hhmm = to24Hour(selectedHour, selectedMinute, selectedPeriod);
    onChange && onChange(hhmm);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange && onChange('');
    setIsOpen(false);
  };

  // Step helpers for keyboard or button increment
  const stepHour = (delta) => {
    setSelectedHour((prev) => {
      let next = prev + delta;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
      scrollToActive(hourListRef.current, next);
      return next;
    });
  };

  const stepMinute = (delta) => {
    setSelectedMinute((prev) => {
      let num = parseInt(prev, 10) + delta;
      if (num >= 60) num = 0;
      if (num < 0) num = 55;
      const nextStr = String(num).padStart(2, '0');
      scrollToActive(minuteListRef.current, nextStr);
      return nextStr;
    });
  };

  const togglePeriod = () => {
    setSelectedPeriod((prev) => {
      const next = prev === 'AM' ? 'PM' : 'AM';
      scrollToActive(periodListRef.current, next);
      return next;
    });
  };

  const displayFormatted = value ? format12Hour(value) : '';
  const previewFormatted = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        marginBottom: label ? 'var(--space-4)' : 0,
        ...style,
      }}
    >
      {label && <Label htmlFor={id} required={required}>{label}</Label>}

      {/* Non-typeable Trigger Button */}
      <button
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label ? `${label}: ${displayFormatted || placeholder}` : `Time: ${displayFormatted || placeholder}`}
        style={{
          width: '100%',
          minHeight: 'var(--touch-target-min)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-bg)',
          color: displayFormatted ? 'var(--color-text)' : 'var(--color-subtle-text)',
          border: '1px solid',
          borderColor: error ? 'var(--color-danger)' : isOpen ? 'var(--color-border-focus)' : 'var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-base)',
          fontFamily: 'var(--font-sans)',
          fontWeight: displayFormatted ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: isOpen ? '0 0 0 2px var(--color-primary-subtle)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '16px' }} aria-hidden="true">🕒</span>
          <span>{displayFormatted || placeholder}</span>
        </span>
        <span style={{ fontSize: '10px', color: 'var(--color-muted-text)' }} aria-hidden="true">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {error && (
        <div
          id={`${id}-error`}
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-danger)',
            marginTop: 'var(--space-1)',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Wheel-style Picker Popup */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Wheel time picker"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-4)',
            width: '280px',
            maxWidth: 'calc(100vw - 32px)',
            boxSizing: 'border-box',
          }}
        >
          {/* Header Preview in 12-Hour Format */}
          <div
            style={{
              textAlign: 'center',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', fontWeight: 700, textTransform: 'uppercase' }}>
              Selected Time
            </div>
            <div
              style={{
                fontSize: 'var(--font-2xl)',
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                marginTop: '2px',
              }}
            >
              {previewFormatted}
            </div>
          </div>

          {/* Quick presets (00, 15, 30, 45) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {['00', '15', '30', '45'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedMinute(m);
                  scrollToActive(minuteListRef.current, m);
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: selectedMinute === m ? 'var(--color-secondary-subtle)' : 'var(--color-bg)',
                  borderColor: selectedMinute === m ? 'var(--color-secondary-hover)' : 'var(--color-border)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: selectedMinute === m ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                :{m}
              </button>
            ))}
          </div>

          {/* Stepper Chevron Buttons (Desktop convenience) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--space-2)',
              marginBottom: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => stepHour(-1)}
              aria-label="Previous hour"
              style={{
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '4px 0',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => stepMinute(-5)}
              aria-label="Minus 5 minutes"
              style={{
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '4px 0',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={togglePeriod}
              aria-label="Toggle AM/PM"
              style={{
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '4px 0',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ▲
            </button>
          </div>

          {/* 3 Wheel Columns */}
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--space-2)',
              backgroundColor: 'var(--color-surface-hover)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '4px',
            }}
          >
            {/* Center selection indicator bar */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '4px',
                right: '4px',
                height: '38px',
                marginTop: '-19px',
                backgroundColor: 'var(--color-primary)',
                opacity: 0.25,
                borderRadius: 'var(--radius-md)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />

            {/* Column 1: Hour (1 - 12) */}
            <div
              ref={hourListRef}
              style={{
                height: '160px',
                overflowY: 'auto',
                scrollSnapType: 'y mandatory',
                position: 'relative',
                zIndex: 1,
                padding: '60px 0',
                textAlign: 'center',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {HOURS.map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <div
                    key={h}
                    data-val={h}
                    onClick={() => {
                      setSelectedHour(h);
                      scrollToActive(hourListRef.current, h);
                    }}
                    style={{
                      height: '38px',
                      lineHeight: '38px',
                      scrollSnapAlign: 'center',
                      fontWeight: isSelected ? 800 : 500,
                      fontSize: isSelected ? 'var(--font-lg)' : 'var(--font-sm)',
                      color: isSelected ? 'var(--color-text)' : 'var(--color-muted-text)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {h}
                  </div>
                );
              })}
            </div>

            {/* Column 2: Minute (00 - 59) */}
            <div
              ref={minuteListRef}
              style={{
                height: '160px',
                overflowY: 'auto',
                scrollSnapType: 'y mandatory',
                position: 'relative',
                zIndex: 1,
                padding: '60px 0',
                textAlign: 'center',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {MINUTES.map((m) => {
                const isSelected = selectedMinute === m;
                return (
                  <div
                    key={m}
                    data-val={m}
                    onClick={() => {
                      setSelectedMinute(m);
                      scrollToActive(minuteListRef.current, m);
                    }}
                    style={{
                      height: '38px',
                      lineHeight: '38px',
                      scrollSnapAlign: 'center',
                      fontWeight: isSelected ? 800 : 500,
                      fontSize: isSelected ? 'var(--font-lg)' : 'var(--font-sm)',
                      color: isSelected ? 'var(--color-text)' : 'var(--color-muted-text)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    :{m}
                  </div>
                );
              })}
            </div>

            {/* Column 3: AM / PM */}
            <div
              ref={periodListRef}
              style={{
                height: '160px',
                overflowY: 'auto',
                scrollSnapType: 'y mandatory',
                position: 'relative',
                zIndex: 1,
                padding: '60px 0',
                textAlign: 'center',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {PERIODS.map((p) => {
                const isSelected = selectedPeriod === p;
                return (
                  <div
                    key={p}
                    data-val={p}
                    onClick={() => {
                      setSelectedPeriod(p);
                      scrollToActive(periodListRef.current, p);
                    }}
                    style={{
                      height: '38px',
                      lineHeight: '38px',
                      scrollSnapAlign: 'center',
                      fontWeight: isSelected ? 800 : 500,
                      fontSize: isSelected ? 'var(--font-lg)' : 'var(--font-sm)',
                      color: isSelected ? 'var(--color-text)' : 'var(--color-muted-text)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {p}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stepper Down Chevron Buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--space-2)',
              marginTop: '4px',
              marginBottom: 'var(--space-3)',
            }}
          >
            <button
              type="button"
              onClick={() => stepHour(1)}
              aria-label="Next hour"
              style={{
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '4px 0',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => stepMinute(5)}
              aria-label="Plus 5 minutes"
              style={{
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '4px 0',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ▼
            </button>
            <button
              type="button"
              onClick={togglePeriod}
              aria-label="Toggle AM/PM"
              style={{
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '4px 0',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ▼
            </button>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-2)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {!required && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-muted-text)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                Clear
              </button>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 12px',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  border: '1px solid var(--color-primary-hover)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                Set Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
