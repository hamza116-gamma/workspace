const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const taskController = require('../controllers/task.controller');

// Creating lives under /channels/:id/tasks, /conversations/:id/tasks and
// /messages/:id/task (turn a message into a task).
const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', taskController.listMine);
router.get('/assignable', taskController.listAssignable);
router.get('/unassigned', taskController.listUnassigned);
router.get('/by-key/:key', taskController.getByKey);
router.get('/:taskId', taskController.get);
router.patch('/:taskId', taskController.update);
router.post('/:taskId/comments', taskController.addComment);
router.post('/:taskId/project', taskController.moveToProject);
router.delete('/:taskId', taskController.remove);

module.exports = router;
