import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import configRoutes from './routes/configController.js';
import blogGeneratorController from './controllers/blogGeneratorController.js';
import { startBlogScheduler } from './scheduler/blogScheduler.js';
import { generateAndPublish } from './controllers/blogGeneratorController.js';
import authRoutes, { requireAuth } from './routes/auth.js';
import blogRoutes from './routes/blogController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

startBlogScheduler(app);

// Route for saving config
app.use('/api', configRoutes);
app.use('/api', blogGeneratorController);
app.use('/api/auth', authRoutes);
app.use('/api', blogRoutes);

// Direct POST route to generate and publish
app.post('/api/generate-and-publish', generateAndPublish);

// Protect all /api routes except /api/auth/*
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return requireAuth(req, res, next);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
