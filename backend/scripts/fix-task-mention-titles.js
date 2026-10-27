/**
 * One-time clean-up: tasks created before mention tokens were converted
 * have raw "<@userId>" / "<!channel>" / "<!here>" in their title or
 * description. Rewrites them to readable "@Full Name" text.
 * Safe to re-run (tasks without tokens are left alone).
 *
 *   node scripts/fix-task-mention-titles.js
 */
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const Task = require('../src/models/task.model');
const User = require('../src/models/user.model');

const TOKEN = /<@([a-f0-9]{24})>|<!channel>|<!here>/i;
const USER_TOKEN = /<@([a-f0-9]{24})>/gi;

const readable = (text, names) =>
  String(text || '')
    .replace(USER_TOKEN, (_match, id) => `@${names.get(id) || 'someone'}`)
    .replace(/<!channel>/g, '@channel')
    .replace(/<!here>/g, '@here');

const main = async () => {
  await connectDatabase();
  const tasks = await Task.find({
    $or: [{ title: { $regex: TOKEN } }, { description: { $regex: TOKEN } }],
  });
  const ids = new Set();
  tasks.forEach((task) =>
    `${task.title} ${task.description}`.replace(USER_TOKEN, (_match, id) => ids.add(id)),
  );
  const users = await User.find({ _id: { $in: [...ids] } }).select('fullName');
  const names = new Map(users.map((user) => [String(user._id), user.fullName]));

  for (const task of tasks) {
    const title = readable(task.title, names).slice(0, 200);
    const description = readable(task.description, names);
    await Task.updateOne({ _id: task._id }, { $set: { title, description } });
    console.log(`fixed TASK-${task.number}: ${title}`);
  }
  console.log(`${tasks.length} task(s) updated`);
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
