const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const searchService = require('../services/search.service');

const search = asyncHandler(async (req, res) => {
  const result = await searchService.search({
    organizationId: req.organization._id,
    userId: req.user._id,
    q: typeof req.query.q === 'string' ? req.query.q : '',
    type: typeof req.query.type === 'string' ? req.query.type : 'all',
    page: req.query.page,
  });
  success(res, result);
});

module.exports = { search };
