import React, { useState, useEffect, useRef } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import Alert from '../components/common/Alert.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import { usePlanner } from '../context/PlannerContext.jsx';
import { loadSavedRoutine, loadGoalChecklists, loadChatPreferences, saveChatPreferences } from '../utils/storage.js';
import { getDailyConsumedTotals, loadNutritionState } from '../utils/nutritionStorage.js';
import { formatLocalDateString, toLocalISODate, formatTime12h } from '../utils/dateUtils.js';
import { generateSchedule } from '../utils/scheduler.js';

const getCurrentTimestamp12h = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return formatTime12h(`${hh}:${mm}`);
};

const CHAT_STORAGE_KEY = 'adaptive_planner_chat_history_v2';
const SESSION_ID_KEY = 'adaptive_planner_chat_session_id';

const DEFAULT_WELCOME_MSG = {
  id: 'welcome-1',
  sender: 'assistant',
  text: `👋 **Welcome! I am your AI Coach & Adaptive Planner.**\n\nI can help you in two ways:\n\n1. **Personal Coach:** Ask me anything about fitness routines, healthy vegetarian meals, English communication, study strategy, or IT support/cloud career roadmaps.\n2. **AI Timetable Planning:** Tell me how your day is going (*"Create a timetable for today"*, *"Regenerate today's plan"*, *"Move English practice to 5 PM"*, *"I finished my study early"*). I will ask short questions to tailor the plan, verify all fixed commitments, and present a proposal for you to approve before anything changes.`,
  timestamp: getCurrentTimestamp12h(),
};

export default function Chatbot() {
  const { selectedDate, setSelectedDate, getPlan, savePlan } = usePlanner();

  const suggestedPrompts = [
    "Create a timetable for today",
    "Regenerate today's plan",
    "Review my diet totals today and give me insights",
    "Move English practice to 5 PM",
    "I finished my study tasks early",
    "Give me advice to improve my English",
    "Suggest healthy meals",
  ];

  // Persistent session ID for server-side state machine
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(SESSION_ID_KEY);
      if (existing) return existing;
      const created = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      window.localStorage.setItem(SESSION_ID_KEY, created);
      return created;
    }
    return `sess_${Date.now()}`;
  });

  // Conversation history persisted in localStorage
  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [DEFAULT_WELCOME_MSG];
    }
    try {
      const stored = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.warn('Failed to load chat history:', err);
    }
    return [DEFAULT_WELCOME_MSG];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusNotification, setStatusNotification] = useState(null);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [lastUserMessage, setLastUserMessage] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } catch (err) {
        console.warn('Failed to save chat history:', err);
      }
    }
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleClearChat = () => {
    const fresh = [DEFAULT_WELCOME_MSG];
    setMessages(fresh);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
    setStatusNotification('Chat history cleared. Regeneration session reset.');
  };

  const handleSend = async (textToSend, actionOverride = null, proposalOverride = null) => {
    const text = typeof textToSend === 'string' ? textToSend.trim() : inputText.trim();
    if (!text && !actionOverride) return;
    if (isLoading) return;

    if (!actionOverride) {
      setInputText('');
      setLastUserMessage(text);
    }
    setErrorMessage(null);
    setStatusNotification(null);

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (text && !actionOverride) {
      const userMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: getCurrentTimestamp12h(),
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const currentPlan = getPlan(selectedDate);
      const savedRoutine = loadSavedRoutine();
      const goalChecklists = loadGoalChecklists();
      const savedPreferences = loadChatPreferences();

      // Send the pending proposal being modified if present
      const proposalPayload = proposalOverride !== undefined ? proposalOverride : pendingProposal;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
          action: actionOverride,
          proposalData: proposalPayload,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text,
          })),
          context: {
            selectedDate,
            currentTime,
            currentPlan,
            savedRoutine,
            goalChecklists,
            savedPreferences,
            pendingProposal: proposalPayload,
            nutrition: {
              consumedTotals: getDailyConsumedTotals(selectedDate),
              targets: loadNutritionState().targets,
              eatenMeals: (loadNutritionState().eatenLog && loadNutritionState().eatenLog[selectedDate]) || [],
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();

      const receivedProposal = data.proposal || data.proposedPlan || null;

      // Update pending proposal state
      if (receivedProposal) {
        setPendingProposal(receivedProposal);
      } else if (data.sessionState === 'applied' || data.sessionState === 'cancelled') {
        setPendingProposal(null);
      }

      const assistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.message || data.reply || "I've processed your request.",
        type: data.type || data.intent || 'info',
        intent: data.intent || data.type,
        sessionState: data.sessionState,
        question: data.question || null,
        questions: data.questions || [],
        quickReplies: data.quickReplies || (data.questions?.length ? data.questions : null),
        canRetry: Boolean(data.canRetry),
        canEditManually: Boolean(data.canEditManually),
        timestamp: getCurrentTimestamp12h(),
        proposal: receivedProposal
          ? {
              ...receivedProposal,
              status: data.sessionState === 'applied' ? 'applied' : 'pending',
            }
          : null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setErrorMessage(`Error: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Unable to process planning request**\n\n${err.message || 'Server timeout or connection issue.'}\nYour current timetable remains unchanged.`,
          canRetry: true,
          canEditManually: true,
          timestamp: getCurrentTimestamp12h(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // User clicks "Apply New Plan"
  const handleApplyProposal = async (messageId, proposal) => {
    if (!proposal || proposal.status === 'applied') return;

    const targetDate = proposal.date || selectedDate;
    const currentPlan = getPlan(targetDate) || {};
    const routine = loadSavedRoutine();

    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Notify server of apply action
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'apply_proposal',
          proposalData: proposal,
          context: {
            selectedDate: targetDate,
            currentPlan,
          },
        }),
      }).catch(console.warn);

      // 2. Canonical task transformation
      const tasksForPlan = (proposal.tasks || []).map((t) => ({
        id: t.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: t.title,
        title: t.title,
        scheduledStart: t.startTime,
        scheduledEnd: t.endTime,
        startTime: t.startTime,
        endTime: t.endTime,
        durationMinutes: Number(t.durationMinutes) || 30,
        status: t.status === 'completed' ? 'completed' : 'pending',
        fixed: Boolean(t.fixed),
        notes: t.notes || '',
        category: t.category || 'Education',
        date: targetDate,
        updatedAt: new Date().toISOString(),
      }));

      const planPayload = {
        ...currentPlan,
        date: targetDate,
        wakeTime: currentPlan.wakeTime || routine.wakeTime || '07:00',
        bedTime: currentPlan.bedTime || routine.bedTime || '23:00',
        workHours: currentPlan.workHours || routine.workHours || null,
        meals: currentPlan.meals || routine.meals || [],
        travelMinutes: currentPlan.travelMinutes ?? routine.travelMinutes ?? 0,
        travel: currentPlan.travel || routine.travel || null,
        commitments: currentPlan.commitments || routine.commitments || [],
        tasks: tasksForPlan,
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
      };

      // 3. Generate schedule blocks for Timetable visual rendering
      const scheduleResult = generateSchedule(planPayload);
      const finalizedPlan = {
        ...planPayload,
        schedule: {
          blocks: scheduleResult.scheduledBlocks || [],
          unscheduled: scheduleResult.unscheduledTasks || [],
          warnings: scheduleResult.warnings || [],
        },
      };

      // 4. Send the finalized proposal through the exact store/save function the manual Dashboard editing uses
      const saveSuccess = savePlan(targetDate, finalizedPlan);

      if (saveSuccess) {
        // Show "applied" ONLY AFTER the save succeeds and the Dashboard reflects it
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.proposal
              ? { ...m, proposal: { ...m.proposal, status: 'applied' } }
              : m
          )
        );
        setPendingProposal(null);
        setStatusNotification(`✓ New timetable successfully applied for ${targetDate}! Dashboard and Timetable updated.`);
      } else {
        setErrorMessage('Failed to save the new timetable to storage. Timetable was not applied.');
      }
    } catch (err) {
      console.error('Apply error:', err);
      setErrorMessage(`Failed to apply proposal: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // User clicks "Modify Plan"
  const handleModifyProposal = async (messageId, proposal) => {
    setPendingProposal(proposal);
    setMessages((prev) => [
      ...prev,
      {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: `✏️ **Modifying Schedule Proposal**\n\nWhat would you like me to change? You can say:\n- *"Move English practice to 5 PM"*\n- *"Add 30 minutes of English practice"*\n- *"Make today's study lighter"*\n- *"Give me a 30-minute break after college"*\n- *"I finished my study tasks early"*`,
        timestamp: getCurrentTimestamp12h(),
      },
    ]);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // User clicks "Cancel"
  const handleCancelProposal = async (messageId) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.proposal
          ? { ...m, proposal: { ...m.proposal, status: 'cancelled' } }
          : m
      )
    );
    setPendingProposal(null);

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'cancel_proposal',
      }),
    }).catch(console.warn);

    setStatusNotification('Schedule proposal cancelled. Your existing timetable was left completely unchanged.');
  };

  // Markdown renderer for assistant messages
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

          if (trimmed.startsWith('### ')) {
            return (
              <h3
                key={idx}
                style={{
                  fontSize: 'var(--font-base)',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  marginTop: 'var(--space-2)',
                  marginBottom: '2px',
                  letterSpacing: '-0.01em',
                }}
              >
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }

          if (trimmed.startsWith('## ')) {
            return (
              <h2
                key={idx}
                style={{
                  fontSize: 'var(--font-md)',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  marginTop: 'var(--space-3)',
                  marginBottom: '2px',
                }}
              >
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            );
          }

          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.substring(2);
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  paddingLeft: 'var(--space-2)',
                  fontSize: 'var(--font-sm)',
                  lineHeight: '1.5',
                }}
              >
                <span style={{ color: 'var(--color-secondary-accent)', fontWeight: 800 }}>•</span>
                <span>{renderInlineFormatting(content)}</span>
              </div>
            );
          }

          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  paddingLeft: 'var(--space-2)',
                  fontSize: 'var(--font-sm)',
                  lineHeight: '1.5',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--color-secondary-accent)', minWidth: '18px' }}>
                  {numMatch[1]}.
                </span>
                <span>{renderInlineFormatting(numMatch[2])}</span>
              </div>
            );
          }

          return (
            <p key={idx} style={{ margin: 0, fontSize: 'var(--font-sm)', lineHeight: '1.55' }}>
              {renderInlineFormatting(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  const renderInlineFormatting = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              padding: '2px 4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Active Date: {formatLocalDateString(selectedDate)}
            </span>
            <Badge type="status" value="in_progress" label="Guided AI Assistant" />
          </div>
          <h1
            style={{
              fontSize: 'var(--font-3xl)',
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            AI Personal Coach & Guided Regeneration
          </h1>
          <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted-text)', marginTop: 'var(--space-1)' }}>
            Conversational scheduling assistant with preference guidance, conflict validation, and approval previews.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" size="sm" onClick={handleClearChat} title="Reset conversation & session">
            🗑️ Clear Chat
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {statusNotification && (
        <Alert type="success" title="Schedule Status" onClose={() => setStatusNotification(null)}>
          {statusNotification}
        </Alert>
      )}

      {errorMessage && (
        <Alert type="error" title="Notice" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Quick Suggested Prompts */}
      <div>
        <div
          style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            color: 'var(--color-muted-text)',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-2)',
            letterSpacing: '0.04em',
          }}
        >
          Suggested Prompts
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              style={{
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-primary)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-subtle)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container Card */}
      <Card
        padding="none"
        style={{
          minHeight: '540px',
          height: 'calc(100vh - 340px)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Messages Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '85%',
                    backgroundColor: isUser ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    border: isUser ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    padding: 'var(--space-3) var(--space-4)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-muted-text)',
                      marginBottom: 'var(--space-1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--space-4)',
                    }}
                  >
                    <span>{isUser ? 'You' : 'AI Personal Coach'}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div>{renderFormattedText(msg.text)}</div>

                  {/* QUICK REPLY BUTTONS FOR GUIDED QUESTIONS */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                        marginTop: 'var(--space-3)',
                        paddingTop: 'var(--space-2)',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {msg.quickReplies.map((qr, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSend(qr)}
                          disabled={isLoading}
                          style={{
                            backgroundColor: 'var(--color-secondary-subtle)',
                            borderColor: 'var(--color-secondary-hover)',
                            color: 'var(--color-text)',
                            fontWeight: 700,
                          }}
                        >
                          👉 {qr}
                        </Button>
                      ))}
                    </div>
                  )}
                  {/* Fallback Action buttons for Retry or Edit Manually (Section 7) */}
                  {(msg.canRetry || msg.canEditManually) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                        marginTop: 'var(--space-3)',
                        paddingTop: 'var(--space-2)',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {msg.canRetry && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => lastUserMessage && handleSend(lastUserMessage)}
                          disabled={isLoading}
                        >
                          🔄 Retry
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.location.hash = '#/dashboard';
                        }}
                      >
                        ✏️ Edit Manually on Dashboard
                      </Button>
                    </div>
                  )}
                </div>

                {/* SCHEDULE PROPOSAL CARD (SECTION 6) */}
                {msg.proposal && (
                  <div
                    style={{
                      marginTop: 'var(--space-3)',
                      maxWidth: '95%',
                      width: '100%',
                      backgroundColor: 'var(--color-surface)',
                      border: '2px solid var(--color-primary)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 'var(--space-2)',
                        borderBottom: '1px solid var(--color-border)',
                        paddingBottom: 'var(--space-2)',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '20px' }}>📋</span>
                        <strong style={{ fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                          Proposed Timetable for {msg.proposal.date || selectedDate}
                        </strong>
                      </div>

                      {msg.proposal.status === 'applied' ? (
                        <Badge type="status" value="completed" label="Applied to Dashboard" />
                      ) : msg.proposal.status === 'cancelled' ? (
                        <Badge type="status" value="skipped" label="Cancelled (Unchanged)" />
                      ) : msg.proposal.status === 'stale' ? (
                        <Badge type="status" value="pending" label="Stale Proposal" />
                      ) : (
                        <Badge type="status" value="rescheduled" label="Awaiting Approval" />
                      )}
                    </div>

                    {/* 1. TABLE OF PROPOSED TASKS (Task, Date, Start, End, Duration, Status, Notes) */}
                    {Array.isArray(msg.proposal.tasks) && msg.proposal.tasks.length > 0 && (
                      <div
                        style={{
                          overflowX: 'auto',
                          marginBottom: 'var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 'var(--font-xs)',
                            textAlign: 'left',
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: 'var(--color-bg)',
                                borderBottom: '1px solid var(--color-border)',
                                color: 'var(--color-muted-text)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              <th style={{ padding: '8px 10px' }}>Task</th>
                              <th style={{ padding: '8px 10px' }}>Date</th>
                              <th style={{ padding: '8px 10px' }}>Start</th>
                              <th style={{ padding: '8px 10px' }}>End</th>
                              <th style={{ padding: '8px 10px' }}>Duration</th>
                              <th style={{ padding: '8px 10px' }}>Status</th>
                              <th style={{ padding: '8px 10px' }}>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.proposal.tasks.map((task, idx) => {
                              const title = task.title || task.name || 'Untitled';
                              const isAdded = msg.proposal.summary?.added?.some((a) =>
                                typeof a === 'string' ? a.includes(title) : a.task?.name === title
                              );
                              const isMoved = msg.proposal.summary?.moved?.some((m) =>
                                typeof m === 'string' ? m.includes(title) : m.task?.name === title
                              );

                              return (
                                <tr
                                  key={task.id || idx}
                                  style={{
                                    borderBottom:
                                      idx === msg.proposal.tasks.length - 1 ? 'none' : '1px solid var(--color-border)',
                                    backgroundColor: isAdded
                                      ? 'var(--color-success-bg)'
                                      : isMoved
                                      ? 'var(--color-secondary-subtle)'
                                      : 'transparent',
                                  }}
                                >
                                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{title}</span>
                                      {isAdded && (
                                        <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 700 }}>
                                          [NEW]
                                        </span>
                                      )}
                                      {isMoved && (
                                        <span style={{ fontSize: '10px', color: 'var(--color-secondary-accent)', fontWeight: 700 }}>
                                          [MOVED]
                                        </span>
                                      )}
                                      {task.fixed && (
                                        <span title="Fixed commitment" style={{ fontSize: '10px', color: 'var(--color-muted-text)' }}>
                                          🔒
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-muted-text)' }}>
                                    {msg.proposal.date || selectedDate}
                                  </td>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                                    {formatTime12h(task.startTime || task.scheduledStart)}
                                  </td>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                                    {formatTime12h(task.endTime || task.scheduledEnd)}
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    {task.durationMinutes}m
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <Badge
                                      type="status"
                                      value={task.status === 'completed' ? 'completed' : 'pending'}
                                      label={task.status === 'completed' ? 'Done' : 'Pending'}
                                    />
                                  </td>
                                  <td
                                    style={{
                                      padding: '8px 10px',
                                      color: 'var(--color-muted-text)',
                                      maxWidth: '180px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {task.notes || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 2. UNDER THE TABLE: Short explanation of retained, moved, added, or left unscheduled */}
                    {msg.proposal.summary && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-2)',
                          backgroundColor: 'var(--color-bg)',
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-xs)',
                          marginBottom: 'var(--space-3)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Summary of Changes & Explanations:
                        </div>
                        {msg.proposal.summary.retained?.length > 0 && (
                          <div style={{ color: 'var(--color-text)' }}>
                            🔒 <strong>Retained ({msg.proposal.summary.retained.length}):</strong>{' '}
                            {msg.proposal.summary.retained.map((r) => (typeof r === 'string' ? r : r.title || r.name)).join(', ')}{' '}
                            <span style={{ color: 'var(--color-muted-text)' }}>— preserved in current time slot.</span>
                          </div>
                        )}
                        {msg.proposal.summary.moved?.length > 0 && (
                          <div style={{ color: 'var(--color-secondary-accent)' }}>
                            🔄 <strong>Moved ({msg.proposal.summary.moved.length}):</strong>{' '}
                            {msg.proposal.summary.moved
                              .map((m) =>
                                typeof m === 'string'
                                  ? m
                                  : `${m.task?.name || m.title} (${m.oldStart ? formatTime12h(m.oldStart) : 'old'} → ${formatTime12h(m.newStart)})`
                              )
                              .join(', ')}
                          </div>
                        )}
                        {msg.proposal.summary.added?.length > 0 && (
                          <div style={{ color: 'var(--color-success)' }}>
                            ➕ <strong>Added ({msg.proposal.summary.added.length}):</strong>{' '}
                            {msg.proposal.summary.added
                              .map((a) => (typeof a === 'string' ? a : `${a.task?.name || a.title} at ${formatTime12h(a.newStart)}`))
                              .join(', ')}
                          </div>
                        )}
                        {msg.proposal.summary.removed?.length > 0 && (
                          <div style={{ color: 'var(--color-danger)' }}>
                            ✕ <strong>Removed ({msg.proposal.summary.removed.length}):</strong>{' '}
                            {msg.proposal.summary.removed.join(', ')}
                          </div>
                        )}
                        {msg.proposal.summary.unscheduled?.length > 0 && (
                          <div style={{ color: 'var(--color-danger)' }}>
                            ⚠️ <strong>Left Unscheduled ({msg.proposal.summary.unscheduled.length}):</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              {msg.proposal.summary.unscheduled.map((u, i) => (
                                <li key={i}>
                                  <strong>{u.title || u.name}</strong>: {u.reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 6 Question Prompt */}
                    {msg.proposal.status === 'pending' && (
                      <div
                        style={{
                          fontSize: 'var(--font-sm)',
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          marginBottom: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--color-primary-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: '4px solid var(--color-primary)',
                        }}
                      >
                        Does this timetable work for you, or would you like to make any changes?
                      </div>
                    )}

                    {/* THREE BUTTONS: Apply New Plan, Modify Plan, Cancel (Section 6) */}
                    {msg.proposal.status === 'pending' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          flexWrap: 'wrap',
                          marginTop: 'var(--space-2)',
                          paddingTop: 'var(--space-3)',
                          borderTop: '1px solid var(--color-border)',
                        }}
                      >
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => handleApplyProposal(msg.id, msg.proposal)}
                          disabled={isLoading}
                          style={{ fontWeight: 800 }}
                        >
                          ⚡ Apply New Plan
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => handleModifyProposal(msg.id, msg.proposal)}
                          disabled={isLoading}
                          style={{ fontWeight: 700 }}
                        >
                          ✏️ Modify Plan
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => handleCancelProposal(msg.id)}
                          disabled={isLoading}
                        >
                          ✕ Cancel
                        </Button>
                      </div>
                    )}

                    {msg.proposal.status === 'applied' && (
                      <div
                        style={{
                          marginTop: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--color-success-bg)',
                          border: '1px solid var(--color-success-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-xs)',
                          color: 'var(--color-success-text)',
                          fontWeight: 700,
                        }}
                      >
                        ✓ This schedule was applied! View your Dashboard or Timetable to see the changes.
                      </div>
                    )}

                    {msg.proposal.status === 'cancelled' && (
                      <div
                        style={{
                          marginTop: 'var(--space-3)',
                          fontSize: 'var(--font-xs)',
                          color: 'var(--color-muted-text)',
                        }}
                      >
                        ✕ Proposal dismissed. Existing schedule was left unchanged.
                      </div>
                    )}

                    {msg.proposal.status === 'stale' && (
                      <div
                        style={{
                          marginTop: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--color-danger-bg)',
                          border: '1px solid var(--color-danger-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-xs)',
                          color: 'var(--color-danger-text)',
                          fontWeight: 700,
                        }}
                      >
                        ⚠️ This proposal is stale because your plan changed. Please request regeneration again.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing / Loading indicator */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)' }}>
              <LoadingSpinner size="sm" />
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', fontStyle: 'italic' }}>
                Analyzing schedule boundaries and verifying commitments...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'center',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              placeholder="Ask personal advice or type schedule instructions..."
              style={{
                flex: 1,
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-base)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-border-focus)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading || !inputText.trim()}
              style={{ fontWeight: 800, minWidth: '88px' }}
            >
              {isLoading ? '...' : 'Send'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
