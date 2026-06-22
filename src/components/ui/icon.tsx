/**
 * Zentrale Icon-Zuordnung — mapt die in Mock-Daten und Komponenten genutzten
 * String-Namen auf lucide-react-Komponenten. Keine Inline-SVG-Duplikate.
 */

import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Home,
  Layers,
  Lock,
  type LucideIcon,
  Menu,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wand2,
  Bell,
} from "lucide-react";

export type IconName =
  | "home"
  | "calendar"
  | "file"
  | "wand"
  | "layers"
  | "sparkles"
  | "search"
  | "bell"
  | "plus"
  | "book"
  | "users"
  | "message"
  | "shield"
  | "user"
  | "filter"
  | "alert"
  | "clock"
  | "lock"
  | "external"
  | "chevron"
  | "menu"
  | "download"
  | "check";

const ICONS: Record<IconName, LucideIcon> = {
  home: Home,
  calendar: Calendar,
  file: FileText,
  wand: Wand2,
  layers: Layers,
  sparkles: Sparkles,
  search: Search,
  bell: Bell,
  plus: Plus,
  book: BookOpen,
  users: Users,
  message: MessageSquare,
  shield: ShieldCheck,
  user: User,
  filter: Filter,
  alert: AlertTriangle,
  clock: Clock,
  lock: Lock,
  external: ExternalLink,
  chevron: ChevronRight,
  menu: Menu,
  download: Download,
  check: Check,
};

export interface IconProps extends React.ComponentProps<LucideIcon> {
  name: IconName;
}

/** Einheitliche Icon-Komponente — stroke-basiert, currentColor, barrierefrei. */
export function Icon({ name, ...rest }: IconProps) {
  const Cmp = ICONS[name];
  return <Cmp aria-hidden {...rest} />;
}