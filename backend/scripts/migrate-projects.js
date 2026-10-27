/**
 * Phase 1 (Projects) migration. Safe to run more than once.
 *
 *   node scripts/migrate-projects.js            dry run: prints what would change
 *   node scripts/migrate-projects.js --apply    makes the changes
 *
 * 1. Existing tasks get projectKey "TASK" (they keep their TASK-n keys and stay
 *    chat tasks; nothing moves into a project, so DM / private tasks never
 *    become visible to anyone new).
 * 2. Drops the old unique index (organization, number): numbers are now unique
 *    per key (TASK, WEB, ...), so WEB-1 and TASK-1 can both exist.
 * 3. Creates the new Task / Project indexes.
 *
 * Back up the database before running with --apply on production.
 */
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const Task = require('../src/models/task.model');
const Project = require('../src/models/project.model');
const { CHAT_TASK_KEY } = require('../src/config/constants');

const APPLY = process.argv.includes('--apply');
const OLD_INDEX = 'organization_1_number_1';

const main = async () => {
  await connectDatabase();
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (add --apply to change data)');

  const missingKey = { projectKey: { $exists: false } };
  const toBackfill = await Task.countDocuments(missingKey);
  console.log(`- tasks without projectKey: ${toBackfill}`);
  if (APPLY && toBackfill) {
    const result = await Task.updateMany(missingKey, {
      $set: { projectKey: CHAT_TASK_KEY, project: null },
    });
    console.log(`  updated ${result.modifiedCount}`);
  }

  const collection = Task.collection;
  const indexes = await collection.indexes();
  const hasOld = indexes.some((index) => index.name === OLD_INDEX);
  console.log(`- old unique index ${OLD_INDEX}: ${hasOld ? 'present' : 'already gone'}`);
  if (APPLY && hasOld) {
    await collection.dropIndex(OLD_INDEX);
    console.log('  dropped');
  }

  if (APPLY) {
    await Task.syncIndexes();
    await Project.syncIndexes();
    console.log('- indexes synced for Task and Project');
  } else {
    console.log('- would sync indexes for Task and Project');
  }

  const total = await Task.countDocuments({});
  const clash = await Task.aggregate([
    { $group: { _id: { o: '$organization', k: '$projectKey', n: '$number' }, c: { $sum: 1 } } },
    { $match: { c: { $gt: 1 } } },
  ]);
  console.log(`- tasks in total: ${total}; duplicate keys: ${clash.length}`);
  if (clash.length) {
    throw new Error('Duplicate task keys found; fix them before applying');
  }
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
