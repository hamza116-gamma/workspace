import type { DndUpdate } from './users';
import { tomorrowAtNine } from './dnd';

/**
 * Slash commands, run in the browser when the composer sends:
 * /shrug /tableflip /unflip /me /dnd /topic.
 */
export type SlashCommand = { name: string; args?: string; description: string };

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'shrug', args: '[message]', description: 'Append ¯\\_(ツ)_/¯ to your message' },
  { name: 'tableflip', args: '[message]', description: 'Flip a table (╯°□°)╯︵ ┻━┻' },
  { name: 'unflip', args: '[message]', description: 'Put the table back ┬─┬ノ( º _ ºノ)' },
  { name: 'me', args: 'text', description: 'Display italicized action text' },
  {
    name: 'dnd',
    args: '[30m|1h|2h|4h|8h|tomorrow|off]',
    description: 'Pause notifications (default 1 hour)',
  },
  { name: 'topic', args: 'text', description: 'Set the channel topic' },
];

/** Commands matching what is typed ("/sh" -> shrug); null when not a "/word". */
export const matchSlashCommands = (text: string): SlashCommand[] | null => {
  const match = /^\/([a-z]*)$/i.exec(text.trim());
  if (!match) return null;
  const query = match[1].toLowerCase();
  return SLASH_COMMANDS.filter((command) => command.name.startsWith(query));
};

export type SlashContext = {
  channelId?: string | null;
  setDnd: (update: DndUpdate) => Promise<void>;
  setTopic: (channelId: string, topic: string) => Promise<void>;
};

/** What to do with the composer text after running a command. */
export type SlashResult =
  | { kind: 'send'; content: string }
  | { kind: 'done'; notice: string }
  | { kind: 'error'; message: string };

const DND_DURATIONS: Record<string, number> = {
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '8h': 480,
};

const withSuffix = (text: string, suffix: string) => (text ? `${text} ${suffix}` : suffix);

/** Returns null when the text is not a known command (it is sent as typed). */
export const runSlashCommand = async (
  text: string,
  context: SlashContext,
): Promise<SlashResult | null> => {
  const match = /^\/([a-z]+)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return null;
  const name = match[1].toLowerCase();
  const rest = (match[2] ?? '').trim();

  switch (name) {
    case 'shrug':
      return { kind: 'send', content: withSuffix(rest, '¯\\_(ツ)_/¯') };
    case 'tableflip':
      return { kind: 'send', content: withSuffix(rest, '(╯°□°)╯︵ ┻━┻') };
    case 'unflip':
      return { kind: 'send', content: withSuffix(rest, '┬─┬ノ( º _ ºノ)') };
    case 'me':
      return rest
        ? { kind: 'send', content: `_${rest}_` }
        : { kind: 'error', message: 'Usage: /me text' };
    case 'dnd': {
      const arg = rest.toLowerCase() || '1h';
      let update: DndUpdate | null = null;
      if (arg === 'off') update = { off: true };
      else if (arg === 'tomorrow') update = { until: tomorrowAtNine().toISOString() };
      else if (DND_DURATIONS[arg]) update = { minutes: DND_DURATIONS[arg] };
      if (!update) {
        return { kind: 'error', message: 'Usage: /dnd [30m|1h|2h|4h|8h|tomorrow|off]' };
      }
      await context.setDnd(update);
      return {
        kind: 'done',
        notice: arg === 'off' ? 'Notifications resumed' : 'Notifications paused',
      };
    }
    case 'topic':
      if (!context.channelId) {
        return { kind: 'error', message: '/topic only works in a channel' };
      }
      await context.setTopic(context.channelId, rest);
      return { kind: 'done', notice: rest ? 'Topic updated' : 'Topic cleared' };
    default:
      return null;
  }
};
