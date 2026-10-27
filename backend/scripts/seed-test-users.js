/**
 * Creates test users "Hamza 1..N" (hamza.shafique+N@desolint.com) and adds
 * them as active MEMBERs to the workspace(s) of hamza.shafique@desolint.com,
 * plus its default channel. Safe to re-run: existing users/memberships are
 * kept (the password is reset to the test password).
 *
 *   node scripts/seed-test-users.js [count]   (default 3)
 */
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const User = require('../src/models/user.model');
const OrganizationMember = require('../src/models/organizationMember.model');
const { hashPassword } = require('../src/utils/password');
const { joinDefaultChannel } = require('../src/services/defaultChannel.service');
const { ORG_ROLES, MEMBER_STATUS } = require('../src/config/constants');

const OWNER_EMAIL = 'hamza.shafique@desolint.com';
const TEST_PASSWORD = 'Hamza123@';
const count = Math.max(1, Number(process.argv[2]) || 3);

const main = async () => {
  await connectDatabase();

  const owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    throw new Error(`No user with email ${OWNER_EMAIL}`);
  }
  const memberships = await OrganizationMember.find({
    user: owner._id,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (memberships.length === 0) {
    throw new Error(`${OWNER_EMAIL} is not in any workspace`);
  }
  const passwordHash = await hashPassword(TEST_PASSWORD);

  for (let n = 1; n <= count; n += 1) {
    const email = `hamza.shafique+${n}@desolint.com`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: { passwordHash, isDisabled: false, disabledAt: null },
        $setOnInsert: { fullName: `Hamza ${n}`, email },
      },
      { upsert: true, new: true },
    );
    for (const { organization } of memberships) {
      await OrganizationMember.updateOne(
        { organization, user: user._id },
        {
          $set: { status: MEMBER_STATUS.ACTIVE },
          $setOnInsert: { role: ORG_ROLES.MEMBER, joinedAt: new Date() },
        },
        { upsert: true },
      );
      await joinDefaultChannel(organization, user._id);
    }
    console.log(`ok  ${user.fullName} <${email}> -> ${memberships.length} workspace(s)`);
  }
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
