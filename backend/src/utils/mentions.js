// Slack-style mention tokens:
//   <@userId>  -> a specific member
//   <!channel> -> everyone in the channel
//   <!here>    -> active members of the channel
// Plain "@channel" / "@here" text is also recognised.

const USER_MENTION = /<@([0-9a-fA-F]{24})>/g;
const CHANNEL_MENTION = /<!channel>|(?:^|\s)@channel\b/i;
const HERE_MENTION = /<!here>|(?:^|\s)@here\b/i;

const parseMentions = (content = '') => {
  const userIds = new Set();
  let match;
  USER_MENTION.lastIndex = 0;
  while ((match = USER_MENTION.exec(content)) !== null) {
    userIds.add(match[1].toLowerCase());
  }

  return {
    userIds: [...userIds],
    all: CHANNEL_MENTION.test(content),
    here: HERE_MENTION.test(content),
  };
};

module.exports = { parseMentions };
