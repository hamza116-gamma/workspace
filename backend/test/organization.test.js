const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const { createWorkspace } = require('./helpers/fixtures');
const organizationService = require('../src/services/organization.service');

before(connect);
after(disconnect);

test('Projects is off by default and can be switched on per workspace', async () => {
  const { organization } = await createWorkspace();
  assert.equal(organization.settings.projectsEnabled, false);
  const { organization: updated, changes } = await organizationService.updateOrganization(
    organization,
    {
      settings: { projectsEnabled: true },
    },
  );
  assert.equal(updated.settings.projectsEnabled, true);
  assert.deepEqual(changes, [{ field: 'projectsEnabled', from: false, to: true }]);
  // Other settings are kept.
  assert.equal(updated.settings.allowMemberChannelCreation, true);
});

test('the Projects switch only accepts true / false', async () => {
  const { organization } = await createWorkspace();
  await assert.rejects(
    organizationService.updateOrganization(organization, { settings: { projectsEnabled: 'yes' } }),
    /must be a boolean/,
  );
});
