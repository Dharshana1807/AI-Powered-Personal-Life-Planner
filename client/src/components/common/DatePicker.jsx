import React, { useState, useRef, useEffect } from 'react';
import { formatDisplayDate, toLocalISODate } from '../../utils/dateUtils.js';
import { Label } from './FormField.jsx';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Reusable DatePicker component.
 * Opens an accessible calendar popup on click/tap.
 * Displays "20 Oct 2026", stores "YYYY-MM-DD".
 */
export default function DatePicker({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = 'Select date...',
  error,
  disabled = false,
  required = false,
  minDate,
  maxDate,
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value or fallback to today
  const todayStr = toLocalISODate();
  const initialDate = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayStr;
  const [initialYear, initialMonth] = initialDate.split('-').map((v) => parseInt(v, 10));

  const [viewYear, setViewYear] = useState(initialYear || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState((initialMonth ? initialMonth - 1 : new Date().getMonth()));

  // Keep view synchronized when value changes from outside
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map((v) => parseInt(v, 10));
      setViewYear(y);
      setViewMonth(m - 1);
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

  const prevMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (dateStr) => {
    onChange && onChange(dateStr);
    setIsOpen(false);
  };

  const handleSetToday = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const today = toLocalISODate();
    const [y, m] = today.split('-').map((v) => parseInt(v, 10));
    setViewYear(y);
    setViewMonth(m - 1);
    onChange && onChange(today);
    setIsOpen(false);
  };

  // Build calendar matrix
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays = [];

  // Trailing days from previous month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    calendarDays.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Leading days of next month to complete grid (up to 42 cells)
  const remainingCells = 42 - calendarDays.length;
  if (remainingCells > 0 && remainingCells < 14) {
    for (let d = 1; d <= remainingCells; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
      });
    }
  }

  const displayFormatted = value ? formatDisplayDate(value) : '';

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
        aria-label={label ? `${label}: ${displayFormatted || placeholder}` : `Date: ${displayFormatted || placeholder}`}
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
          <span style={{ fontSize: '16px' }} aria-hidden="true">📅</span>
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

      {/* Calendar Popup Overlay */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Calendar date picker"
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
            width: '300px',
            maxWidth: 'calc(100vw - 32px)',
            boxSizing: 'border-box',
          }}
        >
          {/* Header with Nav Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              &larr;
            </button>

            <div style={{ fontWeight: 800, fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              &rarr;
            </button>
          </div>

          {/* Weekday Labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                style={{
                  fontSize: 'var(--font-xs)',
                  fontWeight: 700,
                  color: 'var(--color-muted-text)',
                  padding: '4px 0',
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
            }}
          >
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              const isDisabled =
                (minDate && dateStr < minDate) ||
                (maxDate && dateStr > maxDate);

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDisabled) handleSelectDate(dateStr);
                  }}
                  aria-label={`${dayNum} ${MONTH_NAMES[parseInt(dateStr.split('-')[1], 10) - 1]} ${dateStr.split('-')[0]}${isSelected ? ', selected' : ''}${isToday ? ', today' : ''}`}
                  style={{
                    height: '36px',
                    width: '100%',
                    border: isToday && !isSelected ? '1px solid var(--color-secondary-hover)' : '1px solid transparent',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected
                      ? 'var(--color-primary)'
                      : isToday
                      ? 'var(--color-secondary-subtle)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--color-text)'
                      : !isCurrentMonth
                      ? 'var(--color-border-hover)'
                      : 'var(--color-text)',
                    fontWeight: isSelected ? 800 : isToday ? 700 : isCurrentMonth ? 500 : 400,
                    fontSize: 'var(--font-sm)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.3 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color var(--transition-fast)',
                    boxSizing: 'border-box',
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              onClick={handleSetToday}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-secondary-accent)',
                fontWeight: 700,
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Today ({formatDisplayDate(todayStr)})
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-muted-text)',
                fontWeight: 600,
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
