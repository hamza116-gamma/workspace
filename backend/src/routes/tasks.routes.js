const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const taskController = require('../controllers/task.controller');

// Creating lives under /channels/:id/tasks, /conversations/:id/tasks and
// /messages/:id/task (turn a message into a task).
const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', taskController.listMine);
router.get('/:taskId', taskController.get);
router.patch('/:taskId', taskController.update);
router.delete('/:taskId', taskController.remove);

module.exports = router;
