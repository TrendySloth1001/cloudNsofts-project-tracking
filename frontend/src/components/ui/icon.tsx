import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  Home01Icon,
  SparklesIcon,
  Task01Icon,
  TaskDone02Icon,
  InboxIcon,
  Calendar03Icon,
  Analytics01Icon,
  Settings02Icon,
  Search01Icon,
  Add01Icon,
  PlusSignIcon,
  StarIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  DashboardSquare01Icon,
  Table01Icon,
  ListViewIcon,
  GridViewIcon,
  Notification03Icon,
  BellIcon,
  UserIcon,
  UserCircleIcon,
  Cancel01Icon,
  Cancel02Icon,
  Tick02Icon,
  TickDouble01Icon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  Alert02Icon,
  AlertCircleIcon,
  InformationCircleIcon,
  HelpCircleIcon,
  Delete02Icon,
  PencilEdit01Icon,
  Mail01Icon,
  BubbleChatIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Loading03Icon,
  SidebarLeft01Icon,
  Attachment01Icon,
  FilterHorizontalIcon,
  Folder01Icon,
  Logout01Icon,
  Menu01Icon,
  Copy01Icon,
  Link01Icon,
  Clock01Icon,
  Flag02Icon,
  Bookmark01Icon,
} from '@hugeicons/core-free-icons';

/**
 * Semantic icon registry. Components reference icons by intent (e.g. "search")
 * rather than importing Hugeicons directly, so swapping an icon is a one-line
 * change here and the icon set stays consistent across the app.
 */
export const icons = {
  home: Home01Icon,
  ai: SparklesIcon,
  tasks: Task01Icon,
  taskDone: TaskDone02Icon,
  inbox: InboxIcon,
  calendar: Calendar03Icon,
  analytics: Analytics01Icon,
  settings: Settings02Icon,
  search: Search01Icon,
  add: Add01Icon,
  plus: PlusSignIcon,
  star: StarIcon,
  chevronDown: ArrowDown01Icon,
  chevronUp: ArrowUp01Icon,
  chevronRight: ArrowRight01Icon,
  chevronLeft: ArrowLeft01Icon,
  more: MoreHorizontalIcon,
  moreVertical: MoreVerticalIcon,
  board: DashboardSquare01Icon,
  table: Table01Icon,
  list: ListViewIcon,
  grid: GridViewIcon,
  bell: BellIcon,
  bellAlt: Notification03Icon,
  user: UserIcon,
  userCircle: UserCircleIcon,
  close: Cancel01Icon,
  closeCircle: Cancel02Icon,
  check: Tick02Icon,
  checkDouble: TickDouble01Icon,
  checkCircle: CheckmarkCircle02Icon,
  checkSquare: CheckmarkSquare02Icon,
  warning: Alert02Icon,
  alertCircle: AlertCircleIcon,
  info: InformationCircleIcon,
  help: HelpCircleIcon,
  delete: Delete02Icon,
  edit: PencilEdit01Icon,
  mail: Mail01Icon,
  chat: BubbleChatIcon,
  eye: ViewIcon,
  eyeOff: ViewOffSlashIcon,
  loading: Loading03Icon,
  sidebar: SidebarLeft01Icon,
  attachment: Attachment01Icon,
  filter: FilterHorizontalIcon,
  folder: Folder01Icon,
  logout: Logout01Icon,
  menu: Menu01Icon,
  copy: Copy01Icon,
  link: Link01Icon,
  clock: Clock01Icon,
  flag: Flag02Icon,
  bookmark: Bookmark01Icon,
} satisfies Record<string, IconSvgElement>;

export type IconName = keyof typeof icons;

/** Semantic, muted color tones (token-backed) for standalone icons. */
export type IconTone =
  | 'brand'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONE_COLOR: Record<IconTone, string> = {
  brand: 'var(--color-icon-brand)',
  neutral: 'var(--color-icon-neutral)',
  success: 'var(--color-icon-success)',
  warning: 'var(--color-icon-warning)',
  danger: 'var(--color-icon-danger)',
  info: 'var(--color-icon-info)',
};

export interface IconProps {
  /** Semantic icon name from the registry. */
  name: IconName;
  /** Pixel size (width & height). Default 20. */
  size?: number;
  /** Stroke width. Default 1.8 for a refined line weight. */
  strokeWidth?: number;
  /**
   * A muted semantic tone from the token palette. Ignored when `color` is set.
   * Omit to inherit the surrounding text color (`currentColor`).
   */
  tone?: IconTone;
  /** Explicit color override; defaults to `currentColor` (inherits text). */
  color?: string;
  className?: string;
  /**
   * Accessible label. When provided, the icon is exposed to assistive tech;
   * otherwise it is treated as decorative (aria-hidden).
   */
  title?: string;
}

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  tone,
  color,
  className,
  title,
}: IconProps) {
  const resolvedColor = color ?? (tone ? TONE_COLOR[tone] : undefined);
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      strokeWidth={strokeWidth}
      color={resolvedColor}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
