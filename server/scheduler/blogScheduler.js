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

      const updatedConfigs = await Promise.all(
        configs.map(async (config, index) => {
          const configId = config.id || `config-${index + 1}`;
          console.log(`🔍 Checking config: ${configId}`);

          if (config.hasRun) {
            console.log(`⏭️ Skipping ${configId}: already run`);
            return config;
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
            const results = [];

            try {
              for (let i = 0; i < config.articleCount; i++) {
                const articleData = { ...config, articleCount: 1 }; // Ensure 1 article per call
                console.log(`🔄 Generating article ${i + 1} for config ${configId}`);

                // Optional: delay before each generation
                await delay(i * 30 * 1000);

                // Capture result from controller
                let generatedTitle = '';
                await generateAndPublishFromConfig(
                  { body: articleData },
                  {
                    json: (data) => {
                      const result = data.results?.[0]; // Get first result
                      if (result) {
                        const { title, keyword } = result;
                        generatedTitle = title;

                        // Save to DB (content not returned unless you update controller to include markdown or raw)
                        const dateGenerated = new Date().toISOString();
                        const status = 'published';

                        const query = `
                          INSERT INTO articles (title, keyword, content, date_generated, status)
                          VALUES (?, ?, ?, ?, ?)
                        `;
                        db.run(
                          query,
                          [title, keyword, '[Stored as Markdown file]', dateGenerated, status],
                          function (err) {
                            if (err) {
                              console.error('❌ DB error:', err.message);
                            } else {
                              console.log(`✅ Article "${title}" saved to DB with ID: ${this.lastID}`);
                            }
                          }
                        );

                        results.push(result);
                      }
                    },
                    status: (code) => ({
                      json: (err) => console.error(`❌ Error ${code} for ${configId} article ${i + 1}:`, err),
                    }),
                  }
                );
              }

              return { ...config, hasRun: true, articles: results };
            } catch (err) {
              console.error(`❌ Failed to generate for ${configId}:`, err.message);
              return config;
            }
          }

          return config;
        })
      );

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedConfigs, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ Scheduler error:', err.message);
    }
  });

  console.log('🕒 Blog scheduler running every minute...');
}
