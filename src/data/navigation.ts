import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  Bell,
  Bot,
  Bus,
  CalendarCheck,
  Compass,
  LayoutDashboard,
  Map,
  QrCode,
  Settings,
  ShieldAlert,
  Timer,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import type { NavSectionId, UserRole } from '@/src/types/app';

export interface NavItemConfig {
  id: NavSectionId;
  label: string;
  shortLabel: string;
  group: 'Core Platform' | 'Safety & Mobility' | 'Planning & Community' | 'Account';
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'CapeSafe 360',
    shortLabel: 'Home',
    group: 'Core Platform',
    icon: LayoutDashboard,
    description: 'Role-adaptive Cape Town tourism and safety command centre',
  },
  {
    id: 'explore',
    label: 'Explore Cape Town',
    shortLabel: 'Explore',
    group: 'Core Platform',
    icon: Compass,
    description: 'Verified beaches, mountain precincts, and heritage corridors',
  },
  {
    id: 'bookings',
    label: 'Smart Bookings',
    shortLabel: 'Bookings',
    group: 'Core Platform',
    icon: CalendarCheck,
    description: 'Accredited operators with live safety compliance',
  },
  {
    id: 'trips',
    label: 'My Trips',
    shortLabel: 'Trips',
    group: 'Core Platform',
    icon: Map,
    description: 'Day-by-day peninsula itinerary and transit links',
  },
  {
    id: 'safety',
    label: 'Safety Centre',
    shortLabel: 'Safety',
    group: 'Safety & Mobility',
    icon: ShieldAlert,
    description: 'Wind advisories, patrol corridors, and emergency dispatch',
  },
  {
    id: 'check-in',
    label: 'Tourist Check-In',
    shortLabel: 'Check-In',
    group: 'Safety & Mobility',
    icon: Timer,
    description: 'Timed trail and coastal excursion safety check-ins',
  },
  {
    id: 'transport',
    label: 'Transport',
    shortLabel: 'Transit',
    group: 'Safety & Mobility',
    icon: Bus,
    description: 'MyCiTi routes, shuttles, Southern Line rail, and verified bays',
  },
  {
    id: 'pass',
    label: 'Digital Tourist Pass',
    shortLabel: 'Pass',
    group: 'Safety & Mobility',
    icon: QrCode,
    description: 'Offline-ready QR attraction and shuttle pass',
  },
  {
    id: 'ai-assistant',
    label: 'CapeSafe AI',
    shortLabel: 'AI Guide',
    group: 'Planning & Community',
    icon: Bot,
    description: 'Interactive demonstration concierge for safe itinerary planning',
  },
  {
    id: 'community',
    label: 'Community Hub',
    shortLabel: 'Community',
    group: 'Planning & Community',
    icon: Users,
    description: 'Field notes from verified local guides and travelers',
  },
  {
    id: 'budget',
    label: 'Budget Tracker',
    shortLabel: 'Budget',
    group: 'Planning & Community',
    icon: Wallet,
    description: 'ZAR expense ledger across lodging, transit, and passes',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    shortLabel: 'Access',
    group: 'Planning & Community',
    icon: Accessibility,
    description: 'Step-free trails, sensory hours, and interface preferences',
  },
  {
    id: 'challenges',
    label: 'Tourist Challenges',
    shortLabel: 'Challenges',
    group: 'Planning & Community',
    icon: Trophy,
    description: 'Sustainable mobility and safe exploration milestones',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    shortLabel: 'Alerts',
    group: 'Account',
    icon: Bell,
    description: 'Advisory updates, booking confirmations, and reminders',
  },
  {
    id: 'settings',
    label: 'User Settings',
    shortLabel: 'Settings',
    group: 'Account',
    icon: Settings,
    description: 'Profile, emergency contacts, PWA offline cache, and Firebase readiness',
  },
];

export const NAV_GROUPS: Array<NavItemConfig['group']> = [
  'Core Platform',
  'Safety & Mobility',
  'Planning & Community',
  'Account',
];

export const ROLE_LABELS: Record<UserRole, { label: string; short: string; dashboardTitle: string }> = {
  tourist: {
    label: 'Tourist Explorer',
    short: 'Tourist',
    dashboardTitle: 'Tourist Dashboard',
  },
  admin: {
    label: 'Platform Administrator',
    short: 'Admin',
    dashboardTitle: 'Administrator Dashboard',
  },
  provider: {
    label: 'Service Provider',
    short: 'Provider',
    dashboardTitle: 'Service Provider Dashboard',
  },
  safety: {
    label: 'Safety Management',
    short: 'Safety Ops',
    dashboardTitle: 'Safety Management Dashboard',
  },
};
