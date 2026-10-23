const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { searchLimiter } = require('../middleware/rateLimiters');
const searchController = require('../controllers/search.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', searchLimiter, searchController.search);

module.exports = router;
