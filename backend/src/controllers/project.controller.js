const { asyncHandler } = require('../utils/asyncHandler');
const { releaseProjectAssignee } = require('../sockets/taskEvents');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const projectService = require('../services/project.service');
const taskService = require('../services/task.service');
const auditService = require('../services/audit.service');
const { AUDIT_ACTIONS, CHANNEL_TYPES } = require('../config/constants');
const Channel = require('../models/channel.model');

const getIo = (req) => req.app.get('io');
const orgRole = (req) => req.membership?.role;

const projectTarget = (project) => ({
  type: 'project',
  id: String(project._id),
  label: project.key,
});
const audit = (req, action, project, metadata) =>
  auditService.record(req.organization._id, req.user._id, action, projectTarget(project), metadata);

// Sidebars and project lists refresh on any project change.
// Only people who can see the project hear about it: everyone in the
// workspace for a public home channel, else its members (home + linked).
const emitChanged = (req, project, alsoUserIds = []) => {
  const io = getIo(req);
  if (!io) {
    return;
  }
  const payload = {
    organizationId: String(req.organization._id),
    projectId: String(project._id),
  };
  (async () => {
    const home = await Channel.findById(project.homeChannel).select('type');
    if (projectService.isPublic(project) || home?.type === CHANNEL_TYPES.PUBLIC) {
      io.to(`org:${req.organization._id}`).emit('project.changed', payload);
      return;
    }
    const members = await projectService.memberIds(project);
    new Set([...members, ...alsoUserIds.map(String)]).forEach((id) =>
      io.to(`user:${id}`).emit('project.changed', payload),
    );
  })().catch(() => {});
};

// What the viewer may do: drives buttons in the UI (the server re-checks).
const withViewer = async (req, project) => ({
  memberCount: (await projectService.memberIds(project)).size,
  isMember: await projectService.isMember(project, req.user._id),
  // Tickets that would be deleted with the project (no channel to return to).
  channelFreeTickets: await projectService.countChannelFreeTickets(project),
  canManage: await projectService.canManage(project, req.user._id, orgRole(req)),
  readOnly: await projectService.isReadOnly(project),
});

const loadVisible = async (req) => {
  const project = await projectService.findByKey(req.organization._id, req.params.key);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  await projectService.assertCanRead(project, req.user._id);
  return project;
};

const list = asyncHandler(async (req, res) => {
  const projects = await projectService.listForUser(req.organization._id, req.user._id, {
    archived: req.query.archived === 'true',
  });
  const counts = await projectService.countsFor(projects.map((p) => String(p._id)));
  success(res, {
    projects: await Promise.all(
      projects.map(async (project) =>
        projectService.toPublicProject(project, {
          ...(await withViewer(req, project)),
          counts: counts.get(String(project._id)) || { total: 0, done: 0 },
        }),
      ),
    ),
  });
});

const get = asyncHandler(async (req, res) => {
  const project = await loadVisible(req);
  success(res, {
    project: projectService.toPublicProject(project, await withViewer(req, project)),
    // Resolved via a former key: the client can switch its URL to the new one.
    renamed: project.key !== String(req.params.key).toUpperCase(),
  });
});

// Projects are made of the people added to them; channels no longer give
// membership (a channel's tasks join a project only when someone picks it).
const peopleOnly = (body = {}) => {
  if (
    body.homeChannelId ||
    (Array.isArray(body.linkedChannelIds) && body.linkedChannelIds.length)
  ) {
    throw new AppError(400, 'Projects have members, not channels. Add the people instead');
  }
  const rest = { ...body };
  delete rest.homeChannelId;
  delete rest.linkedChannelIds;
  delete rest.adoptTasks;
  return rest;
};

const create = asyncHandler(async (req, res) => {
  const { project, adopted } = await projectService.createProject(
    req.organization._id,
    req.user,
    orgRole(req),
    peopleOnly(req.body),
  );
  await audit(req, AUDIT_ACTIONS.PROJECT_CREATED, project, { adopted });
  emitChanged(req, project);
  success(
    res,
    {
      project: projectService.toPublicProject(project, await withViewer(req, project)),
      adopted,
    },
    201,
  );
});

const update = asyncHandler(async (req, res) => {
  const found = await loadVisible(req);
  const { project, renamedFrom, lostMemberIds } = await projectService.updateProject(
    found,
    req.user._id,
    orgRole(req),
    peopleOnly(req.body),
  );
  if (renamedFrom) {
    await audit(req, AUDIT_ACTIONS.PROJECT_KEY_CHANGED, project, { from: renamedFrom });
  }
  // People who are no longer members at all lose their tickets here.
  for (const userId of lostMemberIds) {
    await releaseProjectAssignee(
      getIo(req),
      project._id,
      userId,
      'was unassigned (no longer a project member)',
    );
  }
  emitChanged(req, project, lostMemberIds);
  success(res, {
    project: projectService.toPublicProject(project, await withViewer(req, project)),
  });
});

const archive = asyncHandler(async (req, res) => {
  const project = await projectService.archiveProject(
    await loadVisible(req),
    req.user._id,
    orgRole(req),
  );
  await audit(req, AUDIT_ACTIONS.PROJECT_ARCHIVED, project);
  emitChanged(req, project);
  success(res, {
    project: projectService.toPublicProject(project, await withViewer(req, project)),
  });
});

const restore = asyncHandler(async (req, res) => {
  const project = await projectService.restoreProject(
    await loadVisible(req),
    req.user._id,
    orgRole(req),
  );
  await audit(req, AUDIT_ACTIONS.PROJECT_RESTORED, project);
  emitChanged(req, project);
  success(res, {
    project: projectService.toPublicProject(project, await withViewer(req, project)),
  });
});

const remove = asyncHandler(async (req, res) => {
  const project = await loadVisible(req);
  // Who to tell must be worked out before the project is gone.
  emitChanged(req, project);
  const { released, deleted } = await projectService.deleteProject(
    project,
    orgRole(req),
    req.body?.confirmKey,
  );
  await audit(req, AUDIT_ACTIONS.PROJECT_DELETED, project, { released, deleted });
  success(res, { id: String(project._id), released, deleted });
});

const listTasks = asyncHandler(async (req, res) => {
  const project = await loadVisible(req);
  const tasks = await taskService.listForProject(project, req.query);
  success(res, { tasks: tasks.map(taskService.toPublicTask) });
});

module.exports = { list, get, create, update, archive, restore, remove, listTasks };
