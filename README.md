# Adaptive AI Life Planner

An integrated, full-stack personal life planning and coaching web application built with Node.js, Express, React, and Google Gemini AI.

---

## 🌟 Core Highlights

- **One Integrated Application**: One unified project, one Express server, one same-origin URL. No duplicate schedulers or scattered microservices.
- **Single Source of Truth**: Unified client data layer in `localStorage` with versioned schema migrations, refresh persistence, JSON backup export, and non-destructive restore.
- **Unified AI Coach & Assistant**: Context-aware Gemini integration via server-side `/api/chat`. API keys are kept strictly on the backend (`.env` gitignored).
- **AI Safety & Determinism**: The AI **only proposes** timetable changes; it never directly mutates saved data without explicit user review and confirmation (`Apply New Plan`).
- **Offline / No-Gemini Mode**: Every scheduling, goal tracking, study, career, nutrition, fitness, habit, focus, journal, and report feature functions completely without an active AI connection.
- **Standardized 12-Hour AM/PM Time System**: All user-visible times display in 12-hour AM/PM format (e.g. `6:00 AM - 8:00 AM`, `4:30 PM - 8:00 PM`) with Day-Part badges (*Morning*, *Afternoon*, *Evening*, *Night*). Internal storage is normalized to 24-hour `"HH:mm"`.
- **Honest Analytics**: Dashboard and progress reports are computed strictly from real saved records and timestamps—never fabricated or AI-hallucinated.

---

## 📐 Architecture & Layout

### Left Sidebar Navigation (13 Modules)
1. **Dashboard** (`#/dashboard`): Daily chronological timeline, greeting, upcoming tasks, habit checklist, daily goals, protein/fiber summary.
2. **Daily Planner** (`#/planner`): Date picker, 12h day view, fixed vs flexible time blocks, conflict detection, Add/Edit/Reschedule task modals.
3. **AI Assistant** (`#/assistant`): Personal coach for schedule generation, study guidance, career roadmaps, recipe recommendations, and English practice.
4. **Goal Tracking** (`#/goals`): 4 categories (Education, Career, Diet, Fitness) with milestones, completion history, and schedule picker.
5. **Study Planner** (`#/study`): Subject syllabus tracking, assignment deadlines, revision planner, and AI conceptual tutoring.
6. **Career Planner** (`#/career`): Target roles, skill roadmaps, certifications, resume checklist, interview prep, and application tracker.
7. **Diet & Nutrition** (`#/nutrition`): Recipe library, macro targets (protein & fiber), meal planner, planned vs eaten confirmation.
8. **Fitness Planner** (`#/fitness`): Workout schedules, exercise durations, completion logging, and guilt-free rest day guidance.
9. **Habit Tracker** (`#/habits`): Daily consistency toggles, 12h preferred times, Day-Part badges, non-destructive streaks.
10. **Focus Mode** (`#/focus`): Preset countdown timer (15/25/45/60 min), pause/resume, session log, and post-timer completion confirmation.
11. **Journal** (`#/journal`): Daily reflections, achievements, challenges, mood tracking, and optional AI summaries.
12. **Progress Reports** (`#/reports`): Daily/weekly/monthly completion rates, study hours, career milestone progress, and AI trend consultations.
13. **Settings** (`#/settings`): Student profile, wake/sleep & meal routine configuration, AI health status, JSON backup export & restore, audit log.

---

## 🚀 Quickstart & Development

### 1. Prerequisites
- Node.js 18+ and npm installed.

### 2. Installation
```bash
git clone <repo-url>
cd "ai planner"
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Google Gemini API key to `.env`:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*(Get a free key at [Google AI Studio](https://aistudio.google.com/)). If omitted, the entire app operates seamlessly in manual mode.*

### 4. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:3000` in your web browser. Express handles both backend endpoints and Vite middleware hot module reloading on the same origin.

### 5. Run Automated Tests
```bash
npm test
```

---

## 🚢 Production Build & Render Deployment

### Local Production Test
```bash
npm run build
npm start
```
Starts Express in production mode serving the optimized client bundle from `/dist`.

### Deploy to Render
The repository includes a root `render.yaml` specification for zero-config deployment as a single **Web Service**:
1. Connect your repository to [Render](https://render.com).
2. Create a new **Web Service** from the repo (or select **Blueprints** to use `render.yaml`).
3. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `GEMINI_API_KEY`: *(Your Gemini API key)*
   - `GEMINI_MODEL`: `gemini-2.5-flash`
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
