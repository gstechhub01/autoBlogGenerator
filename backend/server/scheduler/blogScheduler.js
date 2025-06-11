import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { generateAndPublishFromConfig } from '../controllers/blogGeneratorController.js';
import { db } from '../database.js';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'blog-configs.json');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startBlogScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      if (!fs.existsSync(CONFIG_PATH)) return;

      const configs = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      const now = new Date();
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
              const articleData = { ...config, articleCount: 1 }; // Ensure 1 article per call
              console.log(`🔄 Generating article ${i + 1} for config ${configId}`);

              // Optional: delay before each generation
              await delay(i * 30 * 1000);

              // Pass contentSource and engine to controller
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
          } catch (err) {
            console.error(`❌ Failed to generate for ${configId}:`, err.message);
          }
        }
        // After each config, reload configs from disk to get the latest state
        if (fs.existsSync(CONFIG_PATH)) {
          configs[index] = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))[index];
        }
      }
      // No config file write here! Controller handles all config updates.
    } catch (err) {
      console.error('❌ Scheduler error:', err.message);
    }
  });

  console.log('🕒 Blog scheduler running every minute...');
}
