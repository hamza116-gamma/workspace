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
const Message = require('../src/models/message.model');
const projectService = require('../src/services/project.service');
const { CHAT_TASK_KEY, DEFAULT_TASK_STATUSES } = require('../src/config/constants');

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

  // Home channel became optional: its unique index now ignores projects
  // without one. An old version of the index must be dropped to be rebuilt.
  const projectIndexes = await Project.collection.indexes().catch(() => []);
  const home = projectIndexes.find((index) => index.name === 'homeChannel_1');
  const outdated = home && !home.partialFilterExpression?.homeChannel;
  console.log(`- project home index: ${!home ? 'missing' : outdated ? 'outdated' : 'current'}`);
  if (APPLY && outdated) {
    await Project.collection.dropIndex('homeChannel_1');
    console.log('  dropped (rebuilt below)');
  }

  // Projects no longer take members from channels: today's channel members
  // become direct members, then the channel links are dropped. Hidden ticket
  // threads leave the old home channel (they belong to the project only).
  const channelled = await Project.find({
    $or: [{ homeChannel: { $type: 'objectId' } }, { 'linkedChannels.0': { $exists: true } }],
  });
  console.log(`- projects still tied to channels: ${channelled.length}`);
  for (const project of channelled) {
    const people = await projectService.memberIds(project);
    const tickets = await Task.find({ project: project._id }).select('message');
    const anchors = (
      await Message.find({ _id: { $in: tickets.map((t) => t.message) }, ticketThread: true })
    ).map((m) => m._id);
    console.log(`  ${project.key}: ${people.size} members, ${anchors.length} ticket threads`);
    if (!APPLY) {
      continue;
    }
    await Project.updateOne(
      { _id: project._id },
      { $set: { members: [...people], homeChannel: null, linkedChannels: [] } },
    );
    await Task.updateMany(
      { project: project._id, message: { $in: anchors } },
      { $set: { channel: null } },
    );
    await Message.updateMany(
      { $or: [{ _id: { $in: anchors } }, { parentMessageId: { $in: anchors } }] },
      { $set: { channel: null, project: project._id } },
    );
  }

  // Phase 3: custom statuses. Projects get the default list; every task gets
  // its status group (In review counts as "in progress").
  const noStatuses = { $or: [{ statuses: { $exists: false } }, { statuses: { $size: 0 } }] };
  console.log(`- projects without statuses: ${await Project.countDocuments(noStatuses)}`);
  const noGroup = { statusGroup: { $exists: false } };
  console.log(`- tasks without a status group: ${await Task.countDocuments(noGroup)}`);
  if (APPLY) {
    await Project.updateMany(noStatuses, { $set: { statuses: DEFAULT_TASK_STATUSES } });
    for (const status of DEFAULT_TASK_STATUSES) {
      await Task.updateMany(
        { ...noGroup, status: status.key },
        { $set: { statusGroup: status.group } },
      );
    }
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
