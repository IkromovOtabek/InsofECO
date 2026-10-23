import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from './theme';
import { Palette, size as sz } from './tokens';

/**
 * Ikonkalar — faqat Lucide, 1.5 px chiziq, `currentColor` o'rnida mavzu rangi.
 * Har ikonka alohida fayldan olinadi: butun to'plam (1500+) bundle'ga kirmaydi.
 *
 * Nomlar Lucide'ning o'z nomlari (kebab-case). Server yuboradigan eski Ionicons
 * nomlari (`document-text`, `checkmark-circle`…) `LEGACY` orqali shu nomlarga o'giriladi.
 */
import Plus from 'lucide-react-native/icons/plus';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import AlarmClock from 'lucide-react-native/icons/alarm-clock';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import CircleArrowUp from 'lucide-react-native/icons/circle-arrow-up';
import CircleArrowDown from 'lucide-react-native/icons/circle-arrow-down';
import Delete from 'lucide-react-native/icons/delete';
import Landmark from 'lucide-react-native/icons/landmark';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Bus from 'lucide-react-native/icons/bus';
import Truck from 'lucide-react-native/icons/truck';
import Building from 'lucide-react-native/icons/building';
import Factory from 'lucide-react-native/icons/factory';
import Coffee from 'lucide-react-native/icons/coffee';
import Calculator from 'lucide-react-native/icons/calculator';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Phone from 'lucide-react-native/icons/phone';
import Car from 'lucide-react-native/icons/car';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Banknote from 'lucide-react-native/icons/banknote';
import MessageSquare from 'lucide-react-native/icons/message-square';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import SquareCheck from 'lucide-react-native/icons/square-check';
import Check from 'lucide-react-native/icons/check';
import Copy from 'lucide-react-native/icons/copy';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import X from 'lucide-react-native/icons/x';
import CircleX from 'lucide-react-native/icons/circle-x';
import Wrench from 'lucide-react-native/icons/wrench';
import Package from 'lucide-react-native/icons/package';
import FileText from 'lucide-react-native/icons/file-text';
import Files from 'lucide-react-native/icons/files';
import Download from 'lucide-react-native/icons/download';
import Circle from 'lucide-react-native/icons/circle';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Inbox from 'lucide-react-native/icons/inbox';
import Archive from 'lucide-react-native/icons/archive';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';
import Flag from 'lucide-react-native/icons/flag';
import Zap from 'lucide-react-native/icons/zap';
import Folder from 'lucide-react-native/icons/folder';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Hammer from 'lucide-react-native/icons/hammer';
import HardHat from 'lucide-react-native/icons/hard-hat';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import House from 'lucide-react-native/icons/house';
import Hourglass from 'lucide-react-native/icons/hourglass';
import IdCard from 'lucide-react-native/icons/id-card';
import Info from 'lucide-react-native/icons/info';
import Grid3x3 from 'lucide-react-native/icons/grid-3x3';
import Languages from 'lucide-react-native/icons/languages';
import Layers from 'lucide-react-native/icons/layers';
import List from 'lucide-react-native/icons/list';
import MapPin from 'lucide-react-native/icons/map-pin';
import Locate from 'lucide-react-native/icons/locate';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import Lock from 'lucide-react-native/icons/lock';
import LockOpen from 'lucide-react-native/icons/lock-open';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import Map from 'lucide-react-native/icons/map';
import Menu from 'lucide-react-native/icons/menu';
import Navigation from 'lucide-react-native/icons/navigation';
import Compass from 'lucide-react-native/icons/compass';
import Route from 'lucide-react-native/icons/route';
import Ban from 'lucide-react-native/icons/ban';
import Bell from 'lucide-react-native/icons/bell';
import BellRing from 'lucide-react-native/icons/bell-ring';
import Users from 'lucide-react-native/icons/users';
import User from 'lucide-react-native/icons/user';
import UserPlus from 'lucide-react-native/icons/user-plus';
import UserMinus from 'lucide-react-native/icons/user-minus';
import UserX from 'lucide-react-native/icons/user-x';
import UserCheck from 'lucide-react-native/icons/user-check';
import Target from 'lucide-react-native/icons/target';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import CircleUser from 'lucide-react-native/icons/circle-user';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Tag from 'lucide-react-native/icons/tag';
import Receipt from 'lucide-react-native/icons/receipt';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Scale from 'lucide-react-native/icons/scale';
import ScanLine from 'lucide-react-native/icons/scan-line';
import Search from 'lucide-react-native/icons/search';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Gauge from 'lucide-react-native/icons/gauge';
import Star from 'lucide-react-native/icons/star';
import StarHalf from 'lucide-react-native/icons/star-half';
import Store from 'lucide-react-native/icons/store';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down';
import Clock from 'lucide-react-native/icons/clock';
import ClockArrowLeft from 'lucide-react-native/icons/clock-arrow-left';
import Trash from 'lucide-react-native/icons/trash';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import Wallet from 'lucide-react-native/icons/wallet';
import Droplets from 'lucide-react-native/icons/droplets';
import Camera from 'lucide-react-native/icons/camera';
import Pencil from 'lucide-react-native/icons/pencil';
import KeyRound from 'lucide-react-native/icons/key-round';
import Funnel from 'lucide-react-native/icons/funnel';
import Settings from 'lucide-react-native/icons/settings';
import Warehouse from 'lucide-react-native/icons/warehouse';
import PackageCheck from 'lucide-react-native/icons/package-check';
import Activity from 'lucide-react-native/icons/activity';
import Radio from 'lucide-react-native/icons/radio';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Send from 'lucide-react-native/icons/send';
import Image from 'lucide-react-native/icons/image';
import Dot from 'lucide-react-native/icons/dot';
import Sun from 'lucide-react-native/icons/sun';
import Moon from 'lucide-react-native/icons/moon';
import Minus from 'lucide-react-native/icons/minus';
import Sparkles from 'lucide-react-native/icons/sparkles';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import ArrowDownRight from 'lucide-react-native/icons/arrow-down-right';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Monitor from 'lucide-react-native/icons/monitor';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import Shapes from 'lucide-react-native/icons/shapes';

export const ICONS = {
  plus: Plus, 'circle-plus': CirclePlus, minus: Minus,
  'alarm-clock': AlarmClock, 'circle-alert': CircleAlert, 'triangle-alert': TriangleAlert,
  'arrow-right': ArrowRight, 'arrow-left': ArrowLeft, 'arrow-up': ArrowUp,
  'circle-arrow-up': CircleArrowUp, 'circle-arrow-down': CircleArrowDown,
  delete: Delete, landmark: Landmark, 'chart-column': ChartColumn, 'chart-pie': ChartPie,
  briefcase: Briefcase, bus: Bus, truck: Truck, building: Building, factory: Factory, coffee: Coffee,
  calculator: Calculator, 'calendar-days': CalendarDays, phone: Phone, car: Car, 'shopping-cart': ShoppingCart,
  banknote: Banknote, 'message-square': MessageSquare, 'message-circle': MessageCircle, 'messages-square': MessagesSquare,
  'square-check': SquareCheck, check: Check, copy: Copy, 'circle-check': CircleCheck, 'check-check': CheckCheck,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'chevron-up': ChevronUp, 'chevron-down': ChevronDown,
  'clipboard-list': ClipboardList, x: X, 'circle-x': CircleX, wrench: Wrench, package: Package, 'package-check': PackageCheck,
  'file-text': FileText, files: Files, download: Download, circle: Circle, 'circle-dot': CircleDot, dot: Dot, ellipsis: Ellipsis,
  eye: Eye, 'eye-off': EyeOff, inbox: Inbox, archive: Archive, fingerprint: Fingerprint, flag: Flag, zap: Zap, folder: Folder,
  'layout-grid': LayoutGrid, hammer: Hammer, 'hard-hat': HardHat, 'circle-question-mark': CircleQuestionMark, house: House,
  hourglass: Hourglass, 'id-card': IdCard, info: Info, 'grid-3x3': Grid3x3, languages: Languages, layers: Layers, list: List,
  'map-pin': MapPin, 'map-pinned': MapPinned, locate: Locate, 'locate-fixed': LocateFixed, lock: Lock, 'lock-open': LockOpen,
  'log-in': LogIn, 'log-out': LogOut, mail: Mail, map: Map, menu: Menu, navigation: Navigation, compass: Compass, route: Route, ban: Ban,
  bell: Bell, 'bell-ring': BellRing, users: Users, user: User, 'user-plus': UserPlus, 'user-minus': UserMinus, 'user-x': UserX, 'user-check': UserCheck, target: Target, 'clipboard-check': ClipboardCheck, 'circle-user': CircleUser,
  smartphone: Smartphone, tag: Tag, receipt: Receipt, 'refresh-cw': RefreshCw, scale: Scale, 'scan-line': ScanLine, search: Search,
  'shield-check': ShieldCheck, gauge: Gauge, star: Star, 'star-half': StarHalf, store: Store, 'arrow-left-right': ArrowLeftRight,
  'arrow-up-down': ArrowUpDown, clock: Clock, history: ClockArrowLeft, trash: Trash, 'trending-down': TrendingDown, 'trending-up': TrendingUp,
  wallet: Wallet, droplets: Droplets, camera: Camera, pencil: Pencil, 'key-round': KeyRound, funnel: Funnel, settings: Settings,
  warehouse: Warehouse, activity: Activity, radio: Radio, send: Send, image: Image, sun: Sun, moon: Moon, sparkles: Sparkles, 'heart-pulse': HeartPulse,
  'arrow-up-right': ArrowUpRight, 'arrow-down-right': ArrowDownRight, 'arrow-down': ArrowDown, 'wifi-off': WifiOff, 'cloud-off': CloudOff,
  'ellipsis-vertical': EllipsisVertical, monitor: Monitor, 'sun-moon': SunMoon,
  'hand-coins': HandCoins, shapes: Shapes,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * Eski Ionicons nomlari → Lucide. Server (`/api/mobile/home`) hali shu nomlarni yuboradi;
 * `-outline` qo'shimchasi avtomatik tashlanadi.
 */
const LEGACY: Record<string, IconName> = {
  add: 'plus', 'add-circle': 'circle-plus', alarm: 'alarm-clock', 'alert-circle': 'circle-alert', warning: 'triangle-alert', danger: 'circle-alert',
  'arrow-forward': 'arrow-right', 'arrow-back': 'arrow-left', 'arrow-up-circle': 'circle-arrow-up', 'arrow-down-circle': 'circle-arrow-down',
  backspace: 'delete', bank: 'landmark', 'bar-chart': 'chart-column', 'stats-chart': 'chart-column', 'pie-chart': 'chart-pie',
  business: 'building', cafe: 'coffee', calendar: 'calendar-days', today: 'calendar-days', call: 'phone', cart: 'shopping-cart', cash: 'banknote',
  'chatbox-ellipses': 'message-square', 'chatbubble-ellipses': 'message-circle', chatbubbles: 'messages-square',
  checkbox: 'square-check', checkmark: 'check', 'checkmark-circle': 'circle-check', 'checkmark-done': 'check-check', success: 'circle-check',
  'chevron-back': 'chevron-left', 'chevron-forward': 'chevron-right', clipboard: 'clipboard-list', close: 'x', 'close-circle': 'circle-x',
  construct: 'wrench', cube: 'package', 'document-text': 'file-text', documents: 'files', ellipse: 'circle', 'ellipsis-horizontal-circle': 'ellipsis',
  'file-tray-full': 'inbox', 'file-tray-stacked': 'archive', 'finger-print': 'fingerprint', flash: 'zap', grid: 'layout-grid',
  'help-circle': 'circle-question-mark', home: 'house', 'information-circle': 'info', keypad: 'grid-3x3', language: 'languages',
  location: 'map-pin', 'lock-closed': 'lock', 'navigate-circle': 'navigation', navigate: 'navigation', 'no-store': 'ban',
  notifications: 'bell', people: 'users', person: 'user', 'person-add': 'user-plus', 'person-remove': 'user-minus', 'person-circle': 'circle-user',
  'phone-portrait': 'smartphone', pricetag: 'tag', 'radio-button-on': 'circle-dot', 'radio-button-off': 'circle', refresh: 'refresh-cw', sync: 'refresh-cw',
  scan: 'scan-line', 'shield-checkmark': 'shield-check', speedometer: 'gauge', storefront: 'store', 'swap-horizontal': 'arrow-left-right',
  'swap-vertical': 'arrow-up-down', time: 'clock', 'trash': 'trash', water: 'droplets', 'log-out': 'log-out', 'lock-open': 'lock-open',
};

/** Har qanday nomni (Lucide yoki eski Ionicons) mavjud ikonkaga keltiradi. */
export function resolveIcon(name?: string | null): LucideIcon {
  if (!name) return Circle;
  if (name in ICONS) return ICONS[name as IconName];
  const bare = name.replace(/-(outline|sharp)$/, '');
  if (bare in ICONS) return ICONS[bare as IconName];
  const legacy = LEGACY[bare];
  return legacy ? ICONS[legacy] : Circle;
}

export type IconTone = 'body' | 'muted' | 'faint' | 'strong' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'onBrand' | 'onSolid';
const toneKey: Record<IconTone, keyof Palette> = {
  body: 'textBody', muted: 'textMuted', faint: 'textFaint', strong: 'textStrong', brand: 'brandInk',
  success: 'success', warning: 'warning', danger: 'danger', info: 'info', onBrand: 'textOnBrand', onSolid: 'textOnSolid',
};

/** Ro'yxat/tugmada 16, KPI'da 20. Rang berilmasa mavzuning `textBody` rangi (currentColor o'rnida). */
export function Icon({ name, size = sz.iconSm, color, tone, strokeWidth = 1.5 }: { name: IconName | string; size?: number; color?: string; tone?: IconTone; strokeWidth?: number }) {
  const { c } = useTheme();
  const Cmp = resolveIcon(name);
  const col = color ?? c[toneKey[tone ?? 'body']];
  return <Cmp size={size} color={col} strokeWidth={strokeWidth} absoluteStrokeWidth />;
}
