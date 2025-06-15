import cron from 'node-cron';
import { generateAndPublish } from '../controllers/blogGeneratorController.js';
import { PrismaClient } from '@prisma/client';

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
        const exhaustAllKeywords = config.exhaustAllKeywords !== false; // default true
        console.log(`🔍 Checking config: ${configId}`);
        console.log(`  - exhaustAllKeywords:`, exhaustAllKeywords);
        console.log(`  - status:`, config.status);
        console.log(`  - hasRun:`, config.hasRun);
        console.log(`  - publishIntervalMinutes:`, config.publishIntervalMinutes);
        console.log(`  - lastPublishedAt:`, config.lastPublishedAt);
        let shouldRun = false;
        if (config.hasRun) {
          console.log(`⏭️ Skipping ${configId}: already run`);
          continue;
        }
        if (config.status === 'running') {
          // Auto-reset if stuck in running for too long
          const interval = config.publishIntervalMinutes || 5; // fallback to 5 min if not set
          const startedAt = config.startedAt ? new Date(config.startedAt) : null;
          const maxStuckMs = interval * 2 * 60000; // 2x interval
          if (startedAt && (now - startedAt > maxStuckMs)) {
            // Reset status to pending
            await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'pending', startedAt: null } });
            console.warn(`⚠️ Config ${configId} was stuck in 'running' for too long. Auto-reset to 'pending'.`);
          } else {
            console.log(`⏳ Skipping ${configId}: already running`);
            continue;
          }
        }
        const interval = config.publishIntervalMinutes;
        const lastPublished = config.lastPublishedAt;
        if (exhaustAllKeywords) {
          // Run at interval until all keywords are published
          if (interval && interval > 0) {
            if (!lastPublished) {
              shouldRun = true;
              console.log(`  - No lastPublishedAt, shouldRun = true`);
            } else {
              const nextTime = new Date(lastPublished.getTime() + interval * 60000);
              shouldRun = now >= nextTime;
              console.log(`  - Next eligible time:`, nextTime, '| now:', now, '| shouldRun:', shouldRun);
            }
          } else {
            // No interval set, run immediately if not finished
            shouldRun = true;
            console.log(`  - No interval set, shouldRun = true`);
          }
        } else {
          // One-off job: run at scheduleTime or immediately
          const hasSchedule = !!config.scheduleTime;
          const scheduledTime = hasSchedule ? new Date(config.scheduleTime) : null;
          if (!hasSchedule) {
            shouldRun = true;
            console.log(`⚡ No scheduleTime for ${configId}, running immediately`);
          } else if (!isNaN(scheduledTime)) {
            const diff = Math.abs(scheduledTime - now);
            shouldRun = diff < 60 * 1000;
            console.log(`  - scheduleTime:`, scheduledTime, '| now:', now, '| diff(ms):', diff, '| shouldRun:', shouldRun);
            if (!shouldRun) {
              console.log(`⏳ ${configId} scheduled for: ${scheduledTime.toISOString()}`);
            }
          } else {
            console.warn(`⚠️ Invalid scheduleTime for ${configId}, skipping`);
          }
        }
        // Fetch all unpublished keywords globally
        const unpublishedKeywords = await prisma.keyword.findMany({ where: { published: false } });
        console.log(`  - unpublishedKeywords fetched:`, unpublishedKeywords.map(k => k.keyword));
        if (unpublishedKeywords.length === 0) {
          if (!config.hasRun) {
            if (allKeywords.length > 0) {
              console.log(`  - No unpublished keywords, marking as finished.`);
              await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true, status: 'finished', finishedAt: new Date() } });
            } else {
              console.log(`  - No keywords at all for this config. Not marking as finished. Please check config/keyword setup.`);
            }
          }
          continue;
        }
        // Allocate keywords for this run (from global pool)
        let keywordsToPublish = [];
        if (exhaustAllKeywords) {
          // Publish one or more keywords per interval (respect articleCount/keywordsPerArticle if set)
          const count = config.articleCount || 1;
          keywordsToPublish = unpublishedKeywords.slice(0, count).map(k => k.keyword);
          console.log(`  - Allocated keywords for this run (global):`, keywordsToPublish);
        } else {
          // One-off: just pick the first unpublished keyword
          keywordsToPublish = [unpublishedKeywords[0].keyword];
          console.log(`  - One-off job, keyword to publish (global):`, keywordsToPublish);
        }
        if (shouldRun) {
          // Set status to running and startedAt
          await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'running', startedAt: new Date() } });
          console.log(`⏰ Running blog for config: ${configId}`);
          let processingLog = config.processingLog || [];
          try {
            // Only publish allocated keywords for this interval
            // Sanitize config fields before passing to generateAndPublish
            const sanitizedConfig = {
              ...config,
              sites: typeof config.sites === 'string' ? JSON.parse(config.sites) : config.sites,
              links: typeof config.links === 'string' ? JSON.parse(config.links) : config.links,
              tags: typeof config.tags === 'string' ? JSON.parse(config.tags) : config.tags,
              topics: typeof config.topics === 'string' ? JSON.parse(config.topics) : config.topics,
              autoTitle: config.autoTitle !== false, // default true
            };
            let sites = Array.isArray(sanitizedConfig.sites) ? sanitizedConfig.sites : (sanitizedConfig.sites ? [sanitizedConfig.sites] : []);
            sanitizedConfig.sites = sites;
            // Loop over each keyword to publish
            for (const keyword of keywordsToPublish) {
              const payload = {
                ...sanitizedConfig,
                publishingKeyword: keyword,
                inArticleKeywords: keywordsToPublish.filter(k => k !== keyword),
                // Optionally set link, topic, etc. if needed
              };
              console.log(`  - Calling generateAndPublish for configId: ${configId} with publishingKeyword:`, keyword, 'and sites:', sites);
              await generateAndPublish(
                { body: payload },
                {
                  json: (data) => {
                    processingLog.push({ timestamp: new Date().toISOString(), event: 'publish', data });
                    console.log(`  - generateAndPublish result:`, data);
                    if (data && (data.success === false)) {
                      console.error(`❌ Error for ${configId}:`, data);
                    } else {
                      console.log(`✅ Success for ${configId}:`, data);
                    }
                  },
                  status: (code) => ({
                    json: (payload) => {
                      processingLog.push({ timestamp: new Date().toISOString(), event: 'status', code, payload });
                      console.log(`  - Status callback: code=${code}, payload=`, payload);
                      if (code >= 400) {
                        console.error(`❌ Error ${code} for ${configId}:`, payload);
                      } else {
                        console.log(`ℹ️ Status ${code} for ${configId}:`, payload);
                      }
                    },
                  }),
                }
              );
            }
            // Update lastPublishedAt
            await prisma.blogConfig.update({ where: { id: config.id }, data: { lastPublishedAt: now } });
            // Check if all keywords are published
            const unpublishedCount = await prisma.keyword.count({ where: { published: false } });
            console.log(`  - unpublishedCount after publish (global):`, unpublishedCount);
            if (unpublishedCount === 0) {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true, status: 'finished', finishedAt: new Date(), processingLog } });
              console.log(`  - All keywords published, marked as finished.`);
            } else {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'pending', processingLog } });
              console.log(`  - Still unpublished keywords, status set to pending.`);
            }
          } catch (err) {
            processingLog.push({ timestamp: new Date().toISOString(), event: 'error', error: err.message });
            await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'error', finishedAt: new Date(), processingLog } });
            console.error(`❌ Failed to generate for ${configId}:`, err.message);
          }
        } else {
          console.log(`  - Not time to run configId: ${configId}`);
        }
      }
    } catch (err) {
      console.error('❌ Scheduler error:', err.message);
    }
  });
  console.log('🕒 Blog scheduler running every minute...');
}
