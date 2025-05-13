import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import configRoutes from './routes/configController.js';
import { startBlogScheduler } from './scheduler/blogScheduler.js';
import { generateAndPublishFromConfig } from './controllers/blogGeneratorController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

startBlogScheduler(app);

// Route for saving config
app.use('/api', configRoutes);

// Direct POST route to generate and publish
app.post('/api/generate-and-publish', generateAndPublishFromConfig);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
