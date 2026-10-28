const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { requireProjectsEnabled } = require('../middleware/projects');
const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');

// :key accepts the current key or a former one (renamed projects).
const router = Router();

router.use(requireAuth, requireOrganization, requireProjectsEnabled);

router.get('/', projectController.list);
router.post('/', projectController.create);
router.get('/:key', projectController.get);
router.patch('/:key', projectController.update);
router.delete('/:key', projectController.remove);
router.post('/:key/archive', projectController.archive);
router.post('/:key/restore', projectController.restore);
router.get('/:key/tasks', projectController.listTasks);
router.post('/:key/tasks', taskController.createInProject);
router.get('/:key/milestones', projectController.listMilestones);
router.post('/:key/milestones', projectController.createMilestone);
router.patch('/:key/milestones/:milestoneId', projectController.updateMilestone);
router.delete('/:key/milestones/:milestoneId', projectController.removeMilestone);

module.exports = router;
