import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { processChatRequest } from './chatService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

// Startup check for GEMINI_API_KEY
if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
  console.error('=======================================================');
  console.error('⚠️ [CRITICAL CONFIGURATION NOTICE]: GEMINI_API_KEY is missing.');
  console.error(' AI Chatbot features will be disabled until an API key is added in .env.');
  console.error(' Obtain a free API key at: https://aistudio.google.com/');
  console.error('=======================================================');
}

app.use(express.json());

// API health and configuration check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'Adaptive AI Planner',
    environment: isProduction ? 'production' : 'development',
    model: geminiModel,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    timestamp: new Date().toISOString(),
  });
});

import { processPlannerChat } from './services/gemini-planner/index.js';

// Chatbot endpoint: Intent detection, Personal Coach, Timetable Planning & Guided Regeneration
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, context, sessionId, action, proposalData } = req.body || {};

    // For actions like apply_proposal or cancel_proposal, message can be omitted
    if (!action && (!message || typeof message !== 'string' || !message.trim())) {
      return res.status(400).json({ error: 'Message string is required in request body.' });
    }

    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
      return res.json({
        type: 'info',
        message: '⚠️ **Gemini API Key Required**\n\nThe server cannot process AI planning requests because `GEMINI_API_KEY` is not configured in your `.env` file.\n\nPlease place your Gemini API key in `.env` and restart the application, or continue using the manual Dashboard scheduler.',
        questions: [],
        proposal: null,
        reply: '⚠️ **Gemini API Key Required**\n\nThe server cannot process AI planning requests because `GEMINI_API_KEY` is not configured in your `.env` file.\n\nPlease place your Gemini API key in `.env` and restart the application, or continue using the manual Dashboard scheduler.',
        intent: 'info',
        canEditManually: true,
      });
    }

    const result = await processPlannerChat({
      message: message || '',
      history,
      context,
      sessionId,
      action,
      proposalData,
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.json({
      type: 'info',
      message: `⚠️ **Unable to complete AI planning**\n\n${err.message || 'An unexpected error occurred.'}\nYour current timetable was preserved without changes.`,
      questions: [],
      proposal: null,
      reply: `⚠️ **Unable to complete AI planning**\n\n${err.message || 'An unexpected error occurred.'}\nYour current timetable was preserved without changes.`,
      intent: 'info',
      canRetry: true,
      canEditManually: true,
    });
  }
});

// Configure Vite middleware or production static files
async function startServer() {
  if (!isProduction) {
    console.log('Starting Vite in middleware mode...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: rootDir,
    });

    app.use(vite.middlewares);

    // Fallback for HTML serving with Vite transform
    app.use('*', async (req, res, next) => {
      // Skip API routes so 404s are handled properly
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(rootDir, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (err) {
        vite.ssrFixStacktrace(err);
        next(err);
      }
    });
  } else {
    console.log('Serving production build from dist folder...');
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));

    app.use('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Generic error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(` Adaptive AI Planner is running!`);
    console.log(` Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(` URL:  http://localhost:${PORT} (listening on ${HOST}:${PORT})`);
    console.log(` Model: ${geminiModel}`);
    console.log(` Gemini Key: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not set (using setup guide)'}`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
