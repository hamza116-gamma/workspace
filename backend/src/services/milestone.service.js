const mongoose = require('mongoose');
const Milestone = require('../models/milestone.model');
const Task = require('../models/task.model');
const { MILESTONE_STATUS } = require('../models/milestone.model');
const { AppError } = require('../utils/AppError');
const { STATUS_GROUP } = require('../config/constants');

const idOf = (value) => String(value?._id ?? value);

const toPublicMilestone = (milestone, counts = { total: 0, done: 0 }) => ({
  id: idOf(milestone._id),
  projectId: idOf(milestone.project),
  name: milestone.name,
  description: milestone.description,
  dueDate: milestone.dueDate,
  status: milestone.status,
  total: counts.total,
  done: counts.done,
  createdAt: milestone.createdAt,
});

const assertFields = (payload, { partial = false } = {}) => {
  const fields = {};
  if (!partial || payload.name !== undefined) {
    const name = String(payload.name ?? '').trim();
    if (!name || name.length > 80) {
      throw new AppError(400, 'Milestone name must be 1-80 characters');
    }
    fields.name = name;
  }
  if (payload.description !== undefined) {
    fields.description = String(payload.description ?? '').slice(0, 1000);
  }
  if (payload.dueDate !== undefined) {
    if (payload.dueDate === null || payload.dueDate === '') {
      fields.dueDate = null;
    } else {
      const due = new Date(payload.dueDate);
      if (Number.isNaN(due.getTime())) {
        throw new AppError(400, 'Invalid due date');
      }
      fields.dueDate = due;
    }
  }
  if (payload.status !== undefined) {
    if (!Object.values(MILESTONE_STATUS).includes(payload.status)) {
      throw new AppError(400, 'Milestone status must be OPEN or CLOSED');
    }
    fields.status = payload.status;
  }
  return fields;
};

// { milestoneId: { total, done } } for a project's tickets.
const countsFor = async (projectId) => {
  const rows = await Task.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(idOf(projectId)), milestone: { $ne: null } } },
    {
      $group: {
        _id: '$milestone',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$statusGroup', STATUS_GROUP.DONE] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [idOf(row._id), { total: row.total, done: row.done }]));
};

const list = async (project) => {
  const [milestones, counts] = await Promise.all([
    Milestone.find({ project: project._id }).sort({ status: -1, dueDate: 1, createdAt: 1 }),
    countsFor(project._id),
  ]);
  return milestones.map((m) => toPublicMilestone(m, counts.get(idOf(m._id))));
};

const create = (project, userId, payload) =>
  Milestone.create({
    organization: project.organization,
    project: project._id,
    createdBy: userId,
    ...assertFields(payload),
  });

const find = async (project, milestoneId) => {
  const milestone = mongoose.isValidObjectId(milestoneId)
    ? await Milestone.findOne({ _id: milestoneId, project: project._id })
    : null;
  if (!milestone) {
    throw new AppError(404, 'Milestone not found');
  }
  return milestone;
};

const update = async (project, milestoneId, payload) => {
  const milestone = await find(project, milestoneId);
  Object.assign(milestone, assertFields(payload, { partial: true }));
  await milestone.save();
  return milestone;
};

// Its tickets stay, without a milestone.
const remove = async (project, milestoneId) => {
  const milestone = await find(project, milestoneId);
  await Task.updateMany({ milestone: milestone._id }, { $set: { milestone: null } });
  await milestone.deleteOne();
};

module.exports = { toPublicMilestone, list, create, find, update, remove, countsFor };
