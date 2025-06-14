import cron from 'node-cron';
import { generateAndPublishFromConfig } from '../controllers/blogGeneratorController.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startBlogScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      // Use Prisma to fetch configs that need to run
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
        const hasSchedule = !!config.scheduleTime;
        const scheduledTime = hasSchedule ? new Date(config.scheduleTime) : null;
        let shouldRun = false;
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
        if (shouldRun) {
          console.log(`⏰ Running blog for config: ${configId}`);
          try {
            for (let i = 0; i < config.articleCount; i++) {
              const articleData = { ...config, articleCount: 1 };
              console.log(`🔄 Generating article ${i + 1} for config ${configId}`);
              await delay(i * 30 * 1000);
              await generateAndPublishFromConfig(
                { body: { ...articleData, contentSource: config.contentSource, engine: config.engine } },
                {
                  json: (data) => {
                    if (data && (data.success === false)) {
                      console.error(`❌ Error for ${configId} article ${i + 1}:`, data);
                    } else {
                      console.log(`✅ Success for ${configId} article ${i + 1}:`, data);
                    }
                  },
                  status: (code) => ({
                    json: (payload) => {
                      if (code >= 400) {
                        console.error(`❌ Error ${code} for ${configId} article ${i + 1}:`, payload);
                      } else {
                        console.log(`ℹ️ Status ${code} for ${configId} article ${i + 1}:`, payload);
                      }
                    },
                  }),
                }
              );
            }
            // Mark config as run in DB
            await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true } });
          } catch (err) {
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
