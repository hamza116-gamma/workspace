const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/audit.service');

// GET /organizations/:id/audit?action=&before=  (owners/admins, 50 per page)
const list = asyncHandler(async (req, res) => {
  const result = await auditService.list(req.organization._id, {
    action: typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined,
    before: typeof req.query.before === 'string' && req.query.before ? req.query.before : undefined,
  });
  success(res, result);
});

module.exports = { list };
