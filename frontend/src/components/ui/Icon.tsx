export type IconName =
  | 'search'
  | 'hash'
  | 'lock'
  | 'plus'
  | 'at'
  | 'pencil'
  | 'bookmark'
  | 'message'
  | 'thread'
  | 'dots'
  | 'kebab'
  | 'check'
  | 'checkCircle'
  | 'star'
  | 'info'
  | 'settings'
  | 'copy'
  | 'link'
  | 'trash'
  | 'smile'
  | 'send'
  | 'bell'
  | 'chevron-down'
  | 'chevron-right'
  | 'users'
  | 'logout'
  | 'image'
  | 'archive'
  | 'paperclip'
  | 'close'
  | 'download'
  | 'file'
  | 'pin'
  | 'external'
  | 'mic'
  | 'play'
  | 'pause'
  | 'stop'
  | 'moon'
  | 'sun'
  | 'menu'
  | 'bell-off'
  | 'compass'
  | 'list'
  | 'list-ordered'
  | 'quote'
  | 'code'
  | 'code-block'
  | 'video'
  | 'clock'
  | 'slash'
  | 'headphones'
  | 'video-off'
  | 'mic-off'
  | 'screen'
  | 'phone-down'
  | 'minimize'
  | 'maximize';

const PATHS: Record<IconName, string[]> = {
  search: ['M21 21l-4.35-4.35', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z'],
  hash: ['M4 9h16M4 15h16M10 3 8 21M16 3l-2 18'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  plus: ['M12 5v14M5 12h14'],
  at: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 8'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'],
  bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  message: [
    'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
  ],
  thread: ['M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8M8 13h5'],
  dots: ['M5 12h.01M12 12h.01M19 12h.01'],
  kebab: ['M12 5h.01M12 12h.01M12 19h.01'],
  check: ['M20 6L9 17l-5-5'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.5 12.5l2.5 2.5 4.5-5'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16v-5M12 8h.01'],
  copy: ['M9 9h10v10H9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  trash: [
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  smile: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01M15 9h.01'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5M21 12H9'],
  image: ['M3 5h18v14H3z', 'M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
  archive: ['M21 8v13H3V8M1 3h22v5H1zM10 12h4'],
  paperclip: [
    'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  ],
  close: ['M18 6L6 18M6 6l12 12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  pin: [
    'M12 17v5',
    'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
  ],
  external: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3',
  ],
  mic: ['M12 19v3', 'M8 22h8', 'M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4z'],
  play: ['M8 5v14l11-7z'],
  pause: ['M8 5h3v14H8z', 'M13 5h3v14h-3z'],
  stop: ['M7 7h10v10H7z'],
  sun: [
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  menu: ['M3 6h18M3 12h18M3 18h18'],
  'bell-off': [
    'M13.7 21a2 2 0 0 1-3.4 0',
    'M18.6 13A17.9 17.9 0 0 1 18 8',
    'M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14',
    'M18 8a6 6 0 0 0-9.3-5',
    'M1 1l22 22',
  ],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z'],
  list: ['M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01'],
  'list-ordered': [
    'M10 6h11M10 12h11M10 18h11',
    'M4 6h1v4',
    'M4 10h2',
    'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  ],
  quote: ['M4 6v12', 'M9 8h11M9 12h11M9 16h7'],
  code: ['m8 7-5 5 5 5M16 7l5 5-5 5'],
  'code-block': ['M3 4h18v16H3z', 'm9 9-3 3 3 3M15 9l3 3-3 3'],
  video: ['M15 10l5-3v10l-5-3z', 'M3 6h12v12H3z'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  slash: ['M15 4 9 20'],
  headphones: [
    'M3 18v-6a9 9 0 0 1 18 0v6',
    'M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z',
  ],
  'video-off': [
    'M3 3l18 18',
    'M15 10l5-3v10l-2-1.2',
    'M13 17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 1.4-1.9',
    'M9 6h4a2 2 0 0 1 2 2v3',
  ],
  'mic-off': [
    'M3 3l18 18',
    'M12 19v3',
    'M8 22h8',
    'M9 9v2a3 3 0 0 0 5.1 2.1',
    'M15 9.3V6a3 3 0 0 0-5.7-1.3',
    'M17.9 15A7 7 0 0 1 5 11',
  ],
  screen: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  'phone-down': [
    'M22 15.5c0-1-.7-1.8-1.6-2-2.6-.7-5.5-1-8.4-1s-5.8.3-8.4 1c-.9.2-1.6 1-1.6 2v1.7c0 .8.7 1.4 1.5 1.3l3.3-.5c.7-.1 1.2-.7 1.2-1.4V15c1.3-.3 2.6-.4 4-.4s2.7.1 4 .4v1.6c0 .7.5 1.3 1.2 1.4l3.3.5c.8.1 1.5-.5 1.5-1.3z',
  ],
  minimize: ['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7'],
  maximize: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
};

export const Icon = ({
  name,
  size = 16,
  className,
  filled = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
};
