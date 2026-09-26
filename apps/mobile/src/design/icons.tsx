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
import Plus from 'lucide-react-native/dist/esm/icons/plus.mjs';
import CirclePlus from 'lucide-react-native/dist/esm/icons/circle-plus.mjs';
import AlarmClock from 'lucide-react-native/dist/esm/icons/alarm-clock.mjs';
import CircleAlert from 'lucide-react-native/dist/esm/icons/circle-alert.mjs';
import TriangleAlert from 'lucide-react-native/dist/esm/icons/triangle-alert.mjs';
import ArrowRight from 'lucide-react-native/dist/esm/icons/arrow-right.mjs';
import ArrowLeft from 'lucide-react-native/dist/esm/icons/arrow-left.mjs';
import ArrowUp from 'lucide-react-native/dist/esm/icons/arrow-up.mjs';
import CircleArrowUp from 'lucide-react-native/dist/esm/icons/circle-arrow-up.mjs';
import CircleArrowDown from 'lucide-react-native/dist/esm/icons/circle-arrow-down.mjs';
import Delete from 'lucide-react-native/dist/esm/icons/delete.mjs';
import Landmark from 'lucide-react-native/dist/esm/icons/landmark.mjs';
import ChartColumn from 'lucide-react-native/dist/esm/icons/chart-column.mjs';
import ChartPie from 'lucide-react-native/dist/esm/icons/chart-pie.mjs';
import Briefcase from 'lucide-react-native/dist/esm/icons/briefcase.mjs';
import Bus from 'lucide-react-native/dist/esm/icons/bus.mjs';
import Truck from 'lucide-react-native/dist/esm/icons/truck.mjs';
import Building from 'lucide-react-native/dist/esm/icons/building.mjs';
import Factory from 'lucide-react-native/dist/esm/icons/factory.mjs';
import Coffee from 'lucide-react-native/dist/esm/icons/coffee.mjs';
import Calculator from 'lucide-react-native/dist/esm/icons/calculator.mjs';
import CalendarDays from 'lucide-react-native/dist/esm/icons/calendar-days.mjs';
import Phone from 'lucide-react-native/dist/esm/icons/phone.mjs';
import Car from 'lucide-react-native/dist/esm/icons/car.mjs';
import ShoppingCart from 'lucide-react-native/dist/esm/icons/shopping-cart.mjs';
import Banknote from 'lucide-react-native/dist/esm/icons/banknote.mjs';
import MessageSquare from 'lucide-react-native/dist/esm/icons/message-square.mjs';
import MessageCircle from 'lucide-react-native/dist/esm/icons/message-circle.mjs';
import MessagesSquare from 'lucide-react-native/dist/esm/icons/messages-square.mjs';
import SquareCheck from 'lucide-react-native/dist/esm/icons/square-check.mjs';
import Check from 'lucide-react-native/dist/esm/icons/check.mjs';
import CircleCheck from 'lucide-react-native/dist/esm/icons/circle-check.mjs';
import CheckCheck from 'lucide-react-native/dist/esm/icons/check-check.mjs';
import ChevronLeft from 'lucide-react-native/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide-react-native/dist/esm/icons/chevron-right.mjs';
import ChevronUp from 'lucide-react-native/dist/esm/icons/chevron-up.mjs';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down.mjs';
import ClipboardList from 'lucide-react-native/dist/esm/icons/clipboard-list.mjs';
import X from 'lucide-react-native/dist/esm/icons/x.mjs';
import CircleX from 'lucide-react-native/dist/esm/icons/circle-x.mjs';
import Wrench from 'lucide-react-native/dist/esm/icons/wrench.mjs';
import Package from 'lucide-react-native/dist/esm/icons/package.mjs';
import FileText from 'lucide-react-native/dist/esm/icons/file-text.mjs';
import Files from 'lucide-react-native/dist/esm/icons/files.mjs';
import Download from 'lucide-react-native/dist/esm/icons/download.mjs';
import Circle from 'lucide-react-native/dist/esm/icons/circle.mjs';
import CircleDot from 'lucide-react-native/dist/esm/icons/circle-dot.mjs';
import Ellipsis from 'lucide-react-native/dist/esm/icons/ellipsis.mjs';
import Eye from 'lucide-react-native/dist/esm/icons/eye.mjs';
import EyeOff from 'lucide-react-native/dist/esm/icons/eye-off.mjs';
import Inbox from 'lucide-react-native/dist/esm/icons/inbox.mjs';
import Archive from 'lucide-react-native/dist/esm/icons/archive.mjs';
import Fingerprint from 'lucide-react-native/dist/esm/icons/fingerprint-pattern.mjs';
import Flag from 'lucide-react-native/dist/esm/icons/flag.mjs';
import Zap from 'lucide-react-native/dist/esm/icons/zap.mjs';
import Folder from 'lucide-react-native/dist/esm/icons/folder.mjs';
import LayoutGrid from 'lucide-react-native/dist/esm/icons/layout-grid.mjs';
import Hammer from 'lucide-react-native/dist/esm/icons/hammer.mjs';
import HardHat from 'lucide-react-native/dist/esm/icons/hard-hat.mjs';
import CircleQuestionMark from 'lucide-react-native/dist/esm/icons/circle-question-mark.mjs';
import House from 'lucide-react-native/dist/esm/icons/house.mjs';
import Hourglass from 'lucide-react-native/dist/esm/icons/hourglass.mjs';
import IdCard from 'lucide-react-native/dist/esm/icons/id-card.mjs';
import Info from 'lucide-react-native/dist/esm/icons/info.mjs';
import Grid3x3 from 'lucide-react-native/dist/esm/icons/grid-3x3.mjs';
import Languages from 'lucide-react-native/dist/esm/icons/languages.mjs';
import Layers from 'lucide-react-native/dist/esm/icons/layers.mjs';
import List from 'lucide-react-native/dist/esm/icons/list.mjs';
import MapPin from 'lucide-react-native/dist/esm/icons/map-pin.mjs';
import Locate from 'lucide-react-native/dist/esm/icons/locate.mjs';
import LocateFixed from 'lucide-react-native/dist/esm/icons/locate-fixed.mjs';
import Lock from 'lucide-react-native/dist/esm/icons/lock.mjs';
import LockOpen from 'lucide-react-native/dist/esm/icons/lock-open.mjs';
import LogOut from 'lucide-react-native/dist/esm/icons/log-out.mjs';
import Mail from 'lucide-react-native/dist/esm/icons/mail.mjs';
import Map from 'lucide-react-native/dist/esm/icons/map.mjs';
import Menu from 'lucide-react-native/dist/esm/icons/menu.mjs';
import Navigation from 'lucide-react-native/dist/esm/icons/navigation.mjs';
import Compass from 'lucide-react-native/dist/esm/icons/compass.mjs';
import Route from 'lucide-react-native/dist/esm/icons/route.mjs';
import Ban from 'lucide-react-native/dist/esm/icons/ban.mjs';
import Bell from 'lucide-react-native/dist/esm/icons/bell.mjs';
import BellRing from 'lucide-react-native/dist/esm/icons/bell-ring.mjs';
import Users from 'lucide-react-native/dist/esm/icons/users.mjs';
import User from 'lucide-react-native/dist/esm/icons/user.mjs';
import UserPlus from 'lucide-react-native/dist/esm/icons/user-plus.mjs';
import UserMinus from 'lucide-react-native/dist/esm/icons/user-minus.mjs';
import CircleUser from 'lucide-react-native/dist/esm/icons/circle-user.mjs';
import Smartphone from 'lucide-react-native/dist/esm/icons/smartphone.mjs';
import Tag from 'lucide-react-native/dist/esm/icons/tag.mjs';
import Receipt from 'lucide-react-native/dist/esm/icons/receipt.mjs';
import RefreshCw from 'lucide-react-native/dist/esm/icons/refresh-cw.mjs';
import Scale from 'lucide-react-native/dist/esm/icons/scale.mjs';
import ScanLine from 'lucide-react-native/dist/esm/icons/scan-line.mjs';
import Search from 'lucide-react-native/dist/esm/icons/search.mjs';
import ShieldCheck from 'lucide-react-native/dist/esm/icons/shield-check.mjs';
import Gauge from 'lucide-react-native/dist/esm/icons/gauge.mjs';
import Star from 'lucide-react-native/dist/esm/icons/star.mjs';
import StarHalf from 'lucide-react-native/dist/esm/icons/star-half.mjs';
import Store from 'lucide-react-native/dist/esm/icons/store.mjs';
import ArrowLeftRight from 'lucide-react-native/dist/esm/icons/arrow-left-right.mjs';
import ArrowUpDown from 'lucide-react-native/dist/esm/icons/arrow-up-down.mjs';
import Clock from 'lucide-react-native/dist/esm/icons/clock.mjs';
import ClockArrowLeft from 'lucide-react-native/dist/esm/icons/clock-arrow-left.mjs';
import Trash from 'lucide-react-native/dist/esm/icons/trash.mjs';
import TrendingDown from 'lucide-react-native/dist/esm/icons/trending-down.mjs';
import TrendingUp from 'lucide-react-native/dist/esm/icons/trending-up.mjs';
import Wallet from 'lucide-react-native/dist/esm/icons/wallet.mjs';
import Droplets from 'lucide-react-native/dist/esm/icons/droplets.mjs';
import Camera from 'lucide-react-native/dist/esm/icons/camera.mjs';
import Pencil from 'lucide-react-native/dist/esm/icons/pencil.mjs';
import KeyRound from 'lucide-react-native/dist/esm/icons/key-round.mjs';
import Funnel from 'lucide-react-native/dist/esm/icons/funnel.mjs';
import Settings from 'lucide-react-native/dist/esm/icons/settings.mjs';
import Warehouse from 'lucide-react-native/dist/esm/icons/warehouse.mjs';
import PackageCheck from 'lucide-react-native/dist/esm/icons/package-check.mjs';
import Activity from 'lucide-react-native/dist/esm/icons/activity.mjs';
import Radio from 'lucide-react-native/dist/esm/icons/radio.mjs';
import MapPinned from 'lucide-react-native/dist/esm/icons/map-pinned.mjs';
import Send from 'lucide-react-native/dist/esm/icons/send.mjs';
import Image from 'lucide-react-native/dist/esm/icons/image.mjs';
import Dot from 'lucide-react-native/dist/esm/icons/dot.mjs';
import Sun from 'lucide-react-native/dist/esm/icons/sun.mjs';
import Moon from 'lucide-react-native/dist/esm/icons/moon.mjs';
import Minus from 'lucide-react-native/dist/esm/icons/minus.mjs';

export const ICONS = {
  plus: Plus, 'circle-plus': CirclePlus, minus: Minus,
  'alarm-clock': AlarmClock, 'circle-alert': CircleAlert, 'triangle-alert': TriangleAlert,
  'arrow-right': ArrowRight, 'arrow-left': ArrowLeft, 'arrow-up': ArrowUp,
  'circle-arrow-up': CircleArrowUp, 'circle-arrow-down': CircleArrowDown,
  delete: Delete, landmark: Landmark, 'chart-column': ChartColumn, 'chart-pie': ChartPie,
  briefcase: Briefcase, bus: Bus, truck: Truck, building: Building, factory: Factory, coffee: Coffee,
  calculator: Calculator, 'calendar-days': CalendarDays, phone: Phone, car: Car, 'shopping-cart': ShoppingCart,
  banknote: Banknote, 'message-square': MessageSquare, 'message-circle': MessageCircle, 'messages-square': MessagesSquare,
  'square-check': SquareCheck, check: Check, 'circle-check': CircleCheck, 'check-check': CheckCheck,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'chevron-up': ChevronUp, 'chevron-down': ChevronDown,
  'clipboard-list': ClipboardList, x: X, 'circle-x': CircleX, wrench: Wrench, package: Package, 'package-check': PackageCheck,
  'file-text': FileText, files: Files, download: Download, circle: Circle, 'circle-dot': CircleDot, dot: Dot, ellipsis: Ellipsis,
  eye: Eye, 'eye-off': EyeOff, inbox: Inbox, archive: Archive, fingerprint: Fingerprint, flag: Flag, zap: Zap, folder: Folder,
  'layout-grid': LayoutGrid, hammer: Hammer, 'hard-hat': HardHat, 'circle-question-mark': CircleQuestionMark, house: House,
  hourglass: Hourglass, 'id-card': IdCard, info: Info, 'grid-3x3': Grid3x3, languages: Languages, layers: Layers, list: List,
  'map-pin': MapPin, 'map-pinned': MapPinned, locate: Locate, 'locate-fixed': LocateFixed, lock: Lock, 'lock-open': LockOpen,
  'log-out': LogOut, mail: Mail, map: Map, menu: Menu, navigation: Navigation, compass: Compass, route: Route, ban: Ban,
  bell: Bell, 'bell-ring': BellRing, users: Users, user: User, 'user-plus': UserPlus, 'user-minus': UserMinus, 'circle-user': CircleUser,
  smartphone: Smartphone, tag: Tag, receipt: Receipt, 'refresh-cw': RefreshCw, scale: Scale, 'scan-line': ScanLine, search: Search,
  'shield-check': ShieldCheck, gauge: Gauge, star: Star, 'star-half': StarHalf, store: Store, 'arrow-left-right': ArrowLeftRight,
  'arrow-up-down': ArrowUpDown, clock: Clock, history: ClockArrowLeft, trash: Trash, 'trending-down': TrendingDown, 'trending-up': TrendingUp,
  wallet: Wallet, droplets: Droplets, camera: Camera, pencil: Pencil, 'key-round': KeyRound, funnel: Funnel, settings: Settings,
  warehouse: Warehouse, activity: Activity, radio: Radio, send: Send, image: Image, sun: Sun, moon: Moon,
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
