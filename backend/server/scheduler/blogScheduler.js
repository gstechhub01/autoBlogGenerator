import cron from 'node-cron';
import { generateAndPublishFromConfig } from '../controllers/blogGeneratorController.js';
import { PrismaClient } from '@prisma/client';
import { getUnpublishedKeywords, markKeywordPublishedByKeywordAndSite } from '../database.js';

const prisma = new PrismaClient();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startBlogScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const configs = await prisma.blogConfig.findMany({
        where: {
          OR: [
            { hasRun: false },
            { scheduleTime: { lte: now } },
          ],
        },
      });
      console.log('🔍 Scanning blog configs...');
      for (let index = 0; index < configs.length; index++) {
        const config = configs[index];
        const configId = config.id || `config-${index + 1}`;
        console.log(`🔍 Checking config: ${configId}`);
        if (config.hasRun) {
          console.log(`⏭️ Skipping ${configId}: already run`);
          continue;
        }
        if (config.status === 'running') {
          console.log(`⏳ Skipping ${configId}: already running`);
          continue;
        }
        // Interval-based scheduling logic
        const interval = config.publishIntervalMinutes;
        const lastPublished = config.lastPublishedAt;
        let shouldRun = false;
        if (interval && interval > 0) {
          if (!lastPublished) {
            shouldRun = true;
          } else {
            const nextTime = new Date(lastPublished.getTime() + interval * 60000);
            shouldRun = now >= nextTime;
          }
        } else {
          // Fallback to scheduleTime or immediate
          const hasSchedule = !!config.scheduleTime;
          const scheduledTime = hasSchedule ? new Date(config.scheduleTime) : null;
          if (!hasSchedule) {
            shouldRun = true;
            console.log(`⚡ No scheduleTime for ${configId}, running immediately`);
          } else if (!isNaN(scheduledTime)) {
            const diff = Math.abs(scheduledTime - now);
            shouldRun = diff < 60 * 1000;
            if (!shouldRun) {
              console.log(`⏳ ${configId} scheduled for: ${scheduledTime.toISOString()}`);
            }
          } else {
            console.warn(`⚠️ Invalid scheduleTime for ${configId}, skipping`);
          }
        }
        // Only run if there are unpublished keywords
        const unpublishedKeywords = await getUnpublishedKeywords({ configId: config.id, limit: 1 });
        if (unpublishedKeywords.length === 0) {
          if (!config.hasRun) {
            await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true } });
          }
          continue;
        }
        if (shouldRun) {
          // Set status to running and startedAt
          await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'running', startedAt: new Date() } });
          console.log(`⏰ Running blog for config: ${configId}`);
          let processingLog = config.processingLog || [];
          try {
            // Only publish one article per interval
            const articleData = { ...config, articleCount: 1 };
            await generateAndPublishFromConfig(
              { body: { ...articleData, contentSource: config.contentSource, engine: config.engine } },
              {
                json: (data) => {
                  processingLog.push({ timestamp: new Date().toISOString(), event: 'publish', data });
                  if (data && (data.success === false)) {
                    console.error(`❌ Error for ${configId}:`, data);
                  } else {
                    console.log(`✅ Success for ${configId}:`, data);
                  }
                },
                status: (code) => ({
                  json: (payload) => {
                    processingLog.push({ timestamp: new Date().toISOString(), event: 'status', code, payload });
                    if (code >= 400) {
                      console.error(`❌ Error ${code} for ${configId}:`, payload);
                    } else {
                      console.log(`ℹ️ Status ${code} for ${configId}:`, payload);
                    }
                  },
                }),
              }
            );
            // Update lastPublishedAt
            await prisma.blogConfig.update({ where: { id: config.id }, data: { lastPublishedAt: now } });
            // Check if all keywords are published
            const unpublishedCount = await prisma.keyword.count({ where: { configId: config.id, published: false } });
            if (unpublishedCount === 0) {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true, status: 'finished', finishedAt: new Date(), processingLog } });
            } else {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'pending', processingLog } });
            }
          } catch (err) {
            processingLog.push({ timestamp: new Date().toISOString(), event: 'error', error: err.message });
            await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'error', finishedAt: new Date(), processingLog } });
            console.error(`❌ Failed to generate for ${configId}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('❌ Scheduler error:', err.message);
    }
  });
  console.log('🕒 Blog scheduler running every minute...');
}
