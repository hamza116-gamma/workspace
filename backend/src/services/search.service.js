const Attachment = require('../models/attachment.model');
const Task = require('../models/task.model');
const Project = require('../models/project.model');
const projectService = require('./project.service');
const OrganizationMember = require('../models/organizationMember.model');
const { MEMBER_STATUS } = require('../config/constants');
const { AppError } = require('../utils/AppError');
const { parseSearchQuery, hasFilters, termRegexes } = require('../utils/searchQuery');
const { toPublicAttachment } = require('../utils/attachments');
const { toPublicUser } = require('./user.service');
const { toPublicTask } = require('./task.service');
const { loadSearchScope } = require('./searchScope.service');
const { searchMessages, resolveFrom, dateRange } = require('./searchMessages.service');

const PAGE_SIZE = 20;
const PREVIEW_SIZE = 5;
const TYPES = ['all', 'messages', 'channels', 'people', 'files', 'tasks'];

const matchesAll = (regexes, values) =>
  regexes.every((regex) => values.some((value) => regex.test(String(value || ''))));

const paginate = (list, page, limit) => ({
  items: list.slice(page * limit, page * limit + limit),
  hasMore: list.length > page * limit + limit,
});

const searchChannels = ({ scope, parsed, page, limit }) => {
  const regexes = termRegexes(parsed.terms);
  const list = scope.channels
    .filter((channel) => matchesAll(regexes, [channel.name, channel.topic, channel.purpose]))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((channel) => ({
      id: channel._id,
      name: channel.name,
      topic: channel.topic,
      purpose: channel.purpose,
      type: channel.type,
      status: channel.status,
      isMember: scope.isJoined(channel._id),
    }));
  return paginate(list, page, limit);
};

const searchPeople = async ({ organizationId, parsed, page, limit }) => {
  const regexes = termRegexes(parsed.terms);
  const memberships = await OrganizationMember.find({
    organization: organizationId,
    status: MEMBER_STATUS.ACTIVE,
  }).populate('user');
  const list = memberships
    .filter((membership) => membership.user && !membership.user.isDisabled)
    .filter((membership) => {
      const { fullName, email, jobTitle, department } = membership.user;
      return matchesAll(regexes, [fullName, email, jobTitle, department]);
    })
    .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName))
    .map((membership) => ({ ...toPublicUser(membership.user), orgRole: membership.role }));
  return paginate(list, page, limit);
};

const searchFiles = async ({ organizationId, userId, scope, parsed, page, limit }) => {
  const query = {
    organization: organizationId,
    $or: [{ channel: { $in: scope.channelIds } }, { conversation: { $in: scope.conversationIds } }],
  };
  const and = termRegexes(parsed.terms).map((regex) => ({ originalName: regex }));
  if (parsed.from.length > 0) {
    and.push({ uploader: { $in: await resolveFrom(organizationId, userId, parsed.from) } });
  }
  if (parsed.before || parsed.after) {
    and.push({ createdAt: dateRange(parsed) });
  }
  if (and.length > 0) {
    query.$and = and;
  }
  const found = await Attachment.find(query)
    .sort({ createdAt: -1 })
    .skip(page * limit)
    .limit(limit + 1);
  return {
    items: found.slice(0, limit).map((attachment) => ({
      ...toPublicAttachment(attachment),
      messageId: String(attachment.message),
      channelId: attachment.channel ? String(attachment.channel) : null,
      conversationId: attachment.conversation ? String(attachment.conversation) : null,
    })),
    hasMore: found.length > limit,
  };
};

// A ticket key term ("WEB-12", "web-12", an old TASK-n or a pre-rename key)
// as query conditions; a bare "12" matches any ticket numbered 12.
const keyConditions = async (organizationId, term) => {
  if (/^\d+$/.test(term)) {
    return [{ number: Number(term) }];
  }
  const match = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(term);
  if (!match) {
    return [];
  }
  const prefix = match[1].toUpperCase();
  const number = Number(match[2]);
  const conditions = [{ projectKey: prefix, number }, { formerKeys: `${prefix}-${number}` }];
  // Renamed project: QAW-1 is now QAT-1.
  const renamed = await Project.findOne({ organization: organizationId, formerKeys: prefix });
  if (renamed) {
    conditions.push({ project: renamed._id, number });
  }
  return conditions;
};

// Tasks in chats the user can read. Words match the title, description or a
// label; a key ("WEB-12", "TASK-3", "12") matches that ticket.
const searchTasks = async ({ organizationId, userId, scope, parsed, page, limit }) => {
  // Readable chats, plus every project the user is a member of (direct,
  // home or linked channel) - covers channel-free projects too.
  const projectIds = await projectService.projectIdsForUser(organizationId, userId);
  const query = {
    organization: organizationId,
    $or: [
      { channel: { $in: scope.channelIds } },
      { conversation: { $in: scope.conversationIds } },
      { project: { $in: projectIds } },
    ],
  };
  const and = await Promise.all(
    parsed.terms.map(async (term) => {
      const [regex] = termRegexes([term]);
      const anyText = [{ title: regex }, { description: regex }, { labels: regex }];
      return { $or: [...anyText, ...(await keyConditions(organizationId, term))] };
    }),
  );
  if (and.length > 0) {
    query.$and = and;
  }
  const found = await Task.find(query)
    .sort({ updatedAt: -1 })
    .skip(page * limit)
    .limit(limit + 1)
    .populate('assignees')
    .populate('createdBy');
  return { items: found.slice(0, limit).map(toPublicTask), hasMore: found.length > limit };
};

const empty = { items: [], hasMore: false };

// GET /search?q=&type=all|messages|channels|people|files&page=
const search = async ({ organizationId, userId, q, type = 'all', page = 0 }) => {
  if (!TYPES.includes(type)) {
    throw new AppError(400, 'Unsupported search type');
  }
  const parsed = parseSearchQuery(q);
  const pageIndex = Math.max(Number.parseInt(page, 10) || 0, 0);
  const result = { query: String(q || ''), type, page: pageIndex };
  if (parsed.terms.length === 0 && !hasFilters(parsed)) {
    return {
      ...result,
      messages: empty,
      channels: empty,
      people: empty,
      files: empty,
      tasks: empty,
    };
  }

  const scope = await loadSearchScope(organizationId, userId);
  const all = type === 'all';
  const args = (limit) => ({ organizationId, userId, scope, parsed, page: pageIndex, limit });
  // Channels / people only match plain words; operators apply to messages + files.
  const onlyWords = parsed.terms.length > 0;

  const [messages, channels, people, files, tasks] = await Promise.all([
    all || type === 'messages' ? searchMessages(args(PAGE_SIZE)) : empty,
    (all || type === 'channels') && onlyWords
      ? searchChannels(args(all ? PREVIEW_SIZE : PAGE_SIZE))
      : empty,
    (all || type === 'people') && onlyWords
      ? searchPeople(args(all ? PREVIEW_SIZE : PAGE_SIZE))
      : empty,
    all || type === 'files' ? searchFiles(args(all ? PREVIEW_SIZE : PAGE_SIZE)) : empty,
    (all || type === 'tasks') && onlyWords
      ? searchTasks(args(all ? PREVIEW_SIZE : PAGE_SIZE))
      : empty,
  ]);
  return { ...result, messages, channels, people, files, tasks };
};

module.exports = { search, PAGE_SIZE };
