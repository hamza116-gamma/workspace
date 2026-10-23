/** Curated emoji set with search keywords + "recently used" (localStorage). */
export type EmojiEntry = { emoji: string; keywords: string };

export type EmojiCategory = { id: string; label: string; emojis: EmojiEntry[] };

const e = (emoji: string, keywords: string): EmojiEntry => ({ emoji, keywords });

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: [
      e('😀', 'grin smile happy'),
      e('😄', 'smile happy joy'),
      e('😁', 'grin beam'),
      e('😂', 'joy laugh tears lol'),
      e('🤣', 'rofl laugh'),
      e('😊', 'blush smile'),
      e('😇', 'innocent halo angel'),
      e('🙂', 'slight smile'),
      e('😉', 'wink'),
      e('😍', 'heart eyes love'),
      e('🥰', 'love hearts'),
      e('😘', 'kiss'),
      e('😋', 'yum tasty'),
      e('😜', 'wink tongue crazy'),
      e('🤪', 'zany crazy'),
      e('🤓', 'nerd geek'),
      e('😎', 'cool sunglasses'),
      e('🤩', 'star struck wow'),
      e('🥳', 'party celebrate'),
      e('😏', 'smirk'),
      e('😅', 'sweat smile phew'),
      e('😬', 'grimace awkward'),
      e('🤔', 'thinking hmm'),
      e('🤨', 'raised eyebrow skeptical'),
      e('😐', 'neutral meh'),
      e('🙄', 'eye roll'),
      e('😴', 'sleep tired zzz'),
      e('😌', 'relieved calm'),
      e('😔', 'pensive sad'),
      e('😢', 'cry sad tear'),
      e('😭', 'sob cry'),
      e('😮', 'wow surprised open mouth'),
      e('😱', 'scream shock'),
      e('😤', 'triumph huff'),
      e('😡', 'angry mad rage'),
      e('🤯', 'mind blown exploding'),
      e('🥺', 'pleading puppy'),
      e('🤗', 'hug'),
      e('🤫', 'shush quiet'),
      e('🤐', 'zipper mouth secret'),
      e('😷', 'mask sick'),
      e('🤒', 'sick thermometer'),
      e('🫠', 'melting'),
      e('🙃', 'upside down'),
    ],
  },
  {
    id: 'people',
    label: 'People',
    emojis: [
      e('👍', 'thumbs up yes like +1 ok'),
      e('👎', 'thumbs down no dislike -1'),
      e('👌', 'ok perfect'),
      e('✌️', 'victory peace'),
      e('🤞', 'fingers crossed luck'),
      e('🤝', 'handshake deal agree'),
      e('👏', 'clap applause'),
      e('🙌', 'raised hands hooray'),
      e('🙏', 'pray thanks please'),
      e('👋', 'wave hello bye'),
      e('💪', 'muscle strong flex'),
      e('👀', 'eyes look see'),
      e('🧠', 'brain smart'),
      e('🫡', 'salute'),
      e('🤷', 'shrug dunno'),
      e('🤦', 'facepalm'),
      e('🙋', 'raise hand question'),
      e('🙅', 'no stop'),
      e('🙆', 'ok yes'),
      e('💁', 'info tipping hand'),
      e('👉', 'point right'),
      e('👈', 'point left'),
      e('☝️', 'point up'),
      e('👇', 'point down'),
      e('✍️', 'writing'),
      e('🧑‍💻', 'developer coder laptop'),
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    emojis: [
      e('🐶', 'dog puppy'),
      e('🐱', 'cat kitten'),
      e('🦊', 'fox'),
      e('🐻', 'bear'),
      e('🐼', 'panda'),
      e('🐨', 'koala'),
      e('🦁', 'lion'),
      e('🐸', 'frog'),
      e('🐢', 'turtle slow'),
      e('🐛', 'bug caterpillar'),
      e('🐝', 'bee'),
      e('🦄', 'unicorn'),
      e('🌱', 'seedling plant grow'),
      e('🌳', 'tree'),
      e('🌵', 'cactus'),
      e('🌸', 'blossom flower'),
      e('🌻', 'sunflower'),
      e('🍀', 'clover luck'),
      e('🌈', 'rainbow'),
      e('☀️', 'sun sunny'),
      e('🌙', 'moon night'),
      e('⭐', 'star'),
      e('⚡', 'lightning zap fast'),
      e('❄️', 'snow cold'),
      e('🌊', 'wave ocean'),
    ],
  },
  {
    id: 'food',
    label: 'Food',
    emojis: [
      e('☕', 'coffee tea'),
      e('🍵', 'tea'),
      e('🍺', 'beer'),
      e('🍷', 'wine'),
      e('🥂', 'cheers toast'),
      e('🍕', 'pizza'),
      e('🍔', 'burger'),
      e('🌮', 'taco'),
      e('🍣', 'sushi'),
      e('🍜', 'ramen noodles'),
      e('🍩', 'donut'),
      e('🍪', 'cookie'),
      e('🎂', 'cake birthday'),
      e('🍰', 'cake slice'),
      e('🍎', 'apple'),
      e('🍌', 'banana'),
      e('🥑', 'avocado'),
      e('🌶️', 'pepper spicy hot'),
      e('🍿', 'popcorn'),
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    emojis: [
      e('🎉', 'tada party celebrate'),
      e('🎊', 'confetti'),
      e('🎈', 'balloon'),
      e('🎁', 'gift present'),
      e('🏆', 'trophy win'),
      e('🥇', 'gold medal first'),
      e('🎯', 'target bullseye goal'),
      e('🎮', 'game controller'),
      e('🎲', 'dice'),
      e('🎵', 'music note'),
      e('🎧', 'headphones'),
      e('🎨', 'art palette'),
      e('⚽', 'soccer football'),
      e('🏀', 'basketball'),
      e('🏃', 'run running'),
      e('🧘', 'yoga calm'),
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    emojis: [
      e('🚀', 'rocket ship launch'),
      e('💡', 'idea bulb'),
      e('📌', 'pin pushpin'),
      e('📎', 'paperclip'),
      e('📝', 'memo note'),
      e('📅', 'calendar date'),
      e('📈', 'chart up growth'),
      e('📉', 'chart down'),
      e('📊', 'bar chart'),
      e('💻', 'laptop computer'),
      e('📱', 'phone mobile'),
      e('🔧', 'wrench fix'),
      e('🔨', 'hammer build'),
      e('🛠️', 'tools'),
      e('🔒', 'lock secure'),
      e('🔑', 'key'),
      e('📦', 'package box ship'),
      e('📣', 'megaphone announce'),
      e('🔔', 'bell notification'),
      e('⏰', 'alarm clock time'),
      e('⌛', 'hourglass wait'),
      e('💰', 'money bag'),
      e('📚', 'books read'),
      e('☎️', 'telephone call'),
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    emojis: [
      e('❤️', 'heart love red'),
      e('🧡', 'orange heart'),
      e('💛', 'yellow heart'),
      e('💚', 'green heart'),
      e('💙', 'blue heart'),
      e('💜', 'purple heart'),
      e('🖤', 'black heart'),
      e('💔', 'broken heart'),
      e('💯', 'hundred 100 perfect'),
      e('🔥', 'fire hot lit'),
      e('✨', 'sparkles shiny'),
      e('✅', 'check done yes complete'),
      e('☑️', 'ballot check'),
      e('✔️', 'check mark'),
      e('❌', 'x cross no wrong'),
      e('⚠️', 'warning caution'),
      e('🚫', 'no prohibited'),
      e('❓', 'question'),
      e('❗', 'exclamation important'),
      e('➕', 'plus add'),
      e('🆗', 'ok'),
      e('🆕', 'new'),
      e('🔴', 'red circle'),
      e('🟢', 'green circle'),
      e('🟡', 'yellow circle'),
      e('🔵', 'blue circle'),
    ],
  },
];

export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((category) => category.emojis);

export const searchEmoji = (query: string): EmojiEntry[] => {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return ALL_EMOJI.filter((entry) =>
    entry.keywords.split(' ').some((word) => word.startsWith(term)),
  );
};

const RECENT_KEY = 'emoji.recent';
const MAX_RECENT = 16;

export const loadRecentEmoji = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
};

export const rememberEmoji = (emoji: string): string[] => {
  const next = [emoji, ...loadRecentEmoji().filter((item) => item !== emoji)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents just aren't remembered
  }
  return next;
};
