import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  Phone,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { BrandMark } from '@/src/components/common/BrandMark';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { PWAInstallButton } from '@/src/components/pwa/PWAInstallButton';
import { EmergencyContactsModal } from '@/src/components/safety/EmergencyContactsModal';
import { NAV_GROUPS, NAV_ITEMS, ROLE_LABELS } from '@/src/data/navigation';
import type { DemoUser, NavSectionId, TrustedContact, UserRole } from '@/src/types/app';

interface QuickJumpDestination {
  id: string;
  section: NavSectionId;
  dashboardTab?: string;
  label: string;
  group: string;
  description: string;
}

interface AppShellProps {
  user: DemoUser;
  activePortalRole?: UserRole;
  activeSection: NavSectionId;
  unreadNotifications: number;
  trustedContacts?: TrustedContact[];
  canGoBack?: boolean;
  onGoBack?: () => void;
  onSelectSection: (section: NavSectionId, options?: { dashboardTab?: string }) => void;
  onSwitchRole: (role: UserRole) => void;
  onResendVerification?: () => Promise<void>;
  onRefreshVerification?: () => Promise<void>;
  onGoLanding: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  activePortalRole,
  activeSection,
  unreadNotifications,
  trustedContacts = [],
  canGoBack = false,
  onGoBack,
  onSelectSection,
  onSwitchRole,
  onResendVerification,
  onRefreshVerification,
  onGoLanding,
  onSignOut,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState('');
  const [quickJumpIndex, setQuickJumpIndex] = useState(0);
  const quickJumpInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveRole: UserRole = activePortalRole ?? user.role;
  const currentNav = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0];
  const mobileQuickItems: NavSectionId[] = ['dashboard', 'explore', 'bookings', 'safety'];
  const canSwitchPortals = user.authMode !== 'firebase' || user.role === 'admin';

  const quickJumpDestinations = useMemo<QuickJumpDestination[]>(() => {
    const base: QuickJumpDestination[] = NAV_ITEMS.map((item) => ({
      id: item.id,
      section: item.id,
      dashboardTab: item.id === 'dashboard' ? 'overview' : undefined,
      label: item.label,
      group: item.group,
      description: item.description,
    }));
    if (effectiveRole === 'tourist') {
      base.splice(1, 0, {
        id: 'dashboard-payments',
        section: 'dashboard',
        dashboardTab: 'payments',
        label: 'My Payments & Receipts',
        group: 'Tourist Dashboard Tab',
        description: 'View PayShap, Card & Pay in Person history, statuses, receipts, and saved cards',
      });
    } else if (effectiveRole === 'admin') {
      base.splice(
        1,
        0,
        {
          id: 'admin-governance',
          section: 'dashboard',
          dashboardTab: 'governance',
          label: 'Accreditations & RBAC Queue',
          group: 'Admin Dashboard Tab',
          description: 'Review SAMSA/CATHSSETA provider audits, approve roles, and moderate community flags',
        },
        {
          id: 'admin-announcements',
          section: 'dashboard',
          dashboardTab: 'announcements',
          label: 'Announcements Publisher',
          group: 'Admin Dashboard Tab',
          description: 'Publish, pin, and archive official Cape Town destination notices',
        },
        {
          id: 'admin-payments',
          section: 'dashboard',
          dashboardTab: 'payments',
          label: 'Payments, Refunds & Audit Ledger',
          group: 'Admin Dashboard Tab',
          description: 'Inspect ZAR settlements, issue refunds, and view immutable payment audit logs',
        }
      );
    } else if (effectiveRole === 'provider') {
      base.splice(
        1,
        0,
        {
          id: 'provider-offerings',
          section: 'dashboard',
          dashboardTab: 'offerings',
          label: 'Offerings, Rates & Blackout Dates',
          group: 'Provider Dashboard Tab',
          description: 'Manage inventory capacity, unit pricing, safety checklists, and calendar blackout dates',
        },
        {
          id: 'provider-payments',
          section: 'dashboard',
          dashboardTab: 'payments',
          label: 'Payment Policy & In-Person Ledger',
          group: 'Provider Dashboard Tab',
          description: 'Configure deposit vs Pay in Person rules and mark arrival payments received',
        },
        {
          id: 'provider-accreditation',
          section: 'dashboard',
          dashboardTab: 'accreditation',
          label: 'Boarding Manifest & Accreditation',
          group: 'Provider Dashboard Tab',
          description: 'View live guest accessibility boarding manifest and submit compliance certificates',
        }
      );
    } else if (effectiveRole === 'safety') {
      base.splice(
        1,
        0,
        {
          id: 'safety-checkins',
          section: 'dashboard',
          dashboardTab: 'checkins',
          label: 'Check-In Escalation Monitor',
          group: 'Safety Ops Tab',
          description: 'Triage overdue hiker check-ins, inspect ICE contacts, and confirm safe return',
        },
        {
          id: 'safety-broadcast',
          section: 'dashboard',
          dashboardTab: 'broadcast',
          label: 'Publish Corridor Advisory',
          group: 'Safety Ops Tab',
          description: 'Broadcast Cape Peninsula wind, marine, and trail advisories with field templates',
        }
      );
    }
    return base;
  }, [effectiveRole]);

  const filteredQuickJump = useMemo(() => {
    const q = quickJumpQuery.trim().toLowerCase();
    if (!q) return quickJumpDestinations;
    return quickJumpDestinations.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.group.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }, [quickJumpDestinations, quickJumpQuery]);

  useEffect(() => {
    setQuickJumpIndex(0);
  }, [quickJumpQuery, quickJumpOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickJumpOpen((prev) => !prev);
      } else if (e.key === 'Escape' && quickJumpOpen) {
        setQuickJumpOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickJumpOpen]);

  useEffect(() => {
    if (quickJumpOpen) {
      setTimeout(() => quickJumpInputRef.current?.focus(), 20);
    } else {
      setQuickJumpQuery('');
    }
  }, [quickJumpOpen]);

  const handleNavigate = (
    id: NavSectionId,
    options?: { dashboardTab?: string }
  ) => {
    onSelectSection(id, options);
    setMobileMenuOpen(false);
    setQuickJumpOpen(false);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const normalizedFilter = sidebarFilter.trim().toLowerCase();

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#111827] text-slate-100">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <button
          type="button"
          onClick={onGoLanding}
          className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded-md"
          title="Return to Landing Page"
        >
          <BrandMark inverted compact />
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Portal Indicator / Switcher (RBAC-aware) */}
      <div className="border-b border-white/10 px-4 py-3 space-y-2.5">
        {canSwitchPortals ? (
          <div>
            <label
              htmlFor="sidebar-role-select"
              className="block text-[11px] font-medium text-slate-300 mb-1"
            >
              {user.authMode === 'firebase' ? 'Admin Portal View' : 'Demo Workspace Portal'}
            </label>
            <select
              id="sidebar-role-select"
              value={effectiveRole}
              onChange={(e) => {
                onSwitchRole(e.target.value as UserRole);
                onSelectSection('dashboard', { dashboardTab: 'overview' });
              }}
              className="w-full rounded-lg border border-white/15 bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-white focus:border-blue-400 focus:outline-none"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((roleKey) => (
                <option key={roleKey} value={roleKey}>
                  {ROLE_LABELS[roleKey].dashboardTitle}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-medium text-slate-300">Assigned Access Role</p>
            <p className="mt-0.5 text-xs font-semibold text-blue-300">
              {ROLE_LABELS[effectiveRole].dashboardTitle}
            </p>
          </div>
        )}

        {/* Quick Sidebar Filter */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={sidebarFilter}
            onChange={(e) => setSidebarFilter(e.target.value)}
            placeholder="Filter features..."
            aria-label="Filter navigation features"
            className="w-full rounded-lg border border-white/15 bg-[#1E293B] py-1.5 pl-8 pr-7 text-xs text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />
          {sidebarFilter && (
            <button
              type="button"
              onClick={() => setSidebarFilter('')}
              aria-label="Clear navigation filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Complete 15-feature Navigation */}
      <nav aria-label="Primary application navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {effectiveRole === 'tourist' &&
          (!normalizedFilter ||
            'my payments receipts payshap card'.includes(normalizedFilter) ||
            normalizedFilter.includes('pay')) && (
            <button
              type="button"
              onClick={() => handleNavigate('dashboard', { dashboardTab: 'payments' })}
              className="flex w-full items-center gap-2.5 rounded-lg border border-blue-500/30 bg-[#1E293B] px-3 py-2 text-left text-xs font-semibold text-blue-200 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
            >
              <Wallet className="h-3.5 w-3.5 shrink-0 text-blue-300" aria-hidden="true" />
              <span className="truncate">My Payments &amp; Receipts</span>
            </button>
          )}

        {NAV_GROUPS.map((group) => {
          const groupItems = NAV_ITEMS.filter((item) => {
            if (item.group !== group) return false;
            if (!normalizedFilter) return true;
            return (
              item.label.toLowerCase().includes(normalizedFilter) ||
              item.shortLabel.toLowerCase().includes(normalizedFilter) ||
              item.description.toLowerCase().includes(normalizedFilter) ||
              item.group.toLowerCase().includes(normalizedFilter)
            );
          });
          if (groupItems.length === 0) return null;

          const isCollapsed = !normalizedFilter && Boolean(collapsedGroups[group]);

          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold text-blue-300/90 hover:text-blue-200 transition-colors"
              >
                <span>{group}</span>
                {!normalizedFilter &&
                  (isCollapsed ? (
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  ))}
              </button>
              {!isCollapsed && (
                <ul className="mt-1 space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    const showUnread = item.id === 'notifications' && unreadNotifications > 0;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() =>
                            handleNavigate(
                              item.id,
                              item.id === 'dashboard' ? { dashboardTab: 'overview' } : undefined
                            )
                          }
                          title={item.description}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-[#1D4ED8] text-white'
                              : 'text-slate-200 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {showUnread && (
                            <span className="ml-2 font-mono text-[11px] tabular-nums text-blue-200">
                              {unreadNotifications}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="border-t border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/15 bg-[#1E293B] shrink-0">
            {user.avatarUrl ? (
              <ImageWithFallback src={user.avatarUrl} alt={user.name} />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xs font-bold text-blue-300">
                {user.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-300">
              {ROLE_LABELS[user.role].label} · {user.authMode === 'firebase' ? 'Firebase' : 'Demo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoLanding}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Landing
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  const tabletRailItems: NavSectionId[] = [
    'dashboard',
    'explore',
    'bookings',
    'trips',
    'ai-assistant',
    'safety',
    'check-in',
    'notifications',
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 overflow-x-clip">
      {/* Desktop & Large Desktop Persistent Sidebar (1024px+) */}
      <aside className="hidden lg:block lg:w-64 2xl:w-72 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Tablet Adaptive Icon Navigation Rail (768px–1023px) */}
      <aside
        aria-label="Tablet quick navigation rail"
        className="hidden md:flex lg:hidden w-16 shrink-0 sticky top-0 h-screen flex-col items-center justify-between border-r border-white/10 bg-[#111827] py-3 text-slate-100"
      >
        <div className="flex flex-col items-center gap-2 w-full px-2">
          <button
            type="button"
            onClick={onGoLanding}
            title="CapeSafe Connect 360 Home"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1D4ED8] font-display text-xs font-bold text-white hover:bg-[#1E40AF] transition-colors"
          >
            CS
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            title="Expand full 15-feature navigation drawer"
            aria-label="Expand full navigation drawer"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-[#1E293B] text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Tablet rail sections" className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto py-3 w-full px-2">
          {tabletRailItems.map((id) => {
            const item = NAV_ITEMS.find((n) => n.id === id);
            if (!item) return null;
            const Icon = item.icon;
            const active = activeSection === id;
            const hasUnread = id === 'notifications' && unreadNotifications > 0;
            return (
              <button
                key={`rail-${id}`}
                type="button"
                onClick={() =>
                  handleNavigate(id, id === 'dashboard' ? { dashboardTab: 'overview' } : undefined)
                }
                title={item.label}
                aria-label={item.label}
                className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {hasUnread && (
                  <span className="absolute right-1.5 top-1.5 font-mono text-[9px] font-bold text-blue-300 tabular-nums">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-1.5 px-2">
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            title="Account & Settings"
            aria-label="Account and Settings"
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              activeSection === 'settings'
                ? 'bg-[#1D4ED8] text-white'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="font-display text-xs font-bold">
              {user.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Full Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="All navigation features">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-xl">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Quick Jump Command Palette (Ctrl/Cmd + K) */}
      {quickJumpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick navigation jump"
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#090D16]/60 p-4 pt-16 sm:pt-24"
          onClick={() => setQuickJumpOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Search className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
              <input
                ref={quickJumpInputRef}
                type="text"
                value={quickJumpQuery}
                onChange={(e) => setQuickJumpQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setQuickJumpIndex((i) =>
                      filteredQuickJump.length === 0 ? 0 : (i + 1) % filteredQuickJump.length
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setQuickJumpIndex((i) =>
                      filteredQuickJump.length === 0
                        ? 0
                        : (i - 1 + filteredQuickJump.length) % filteredQuickJump.length
                    );
                  } else if (e.key === 'Enter' && filteredQuickJump[quickJumpIndex]) {
                    e.preventDefault();
                    const dest = filteredQuickJump[quickJumpIndex];
                    handleNavigate(
                      dest.section,
                      dest.dashboardTab ? { dashboardTab: dest.dashboardTab } : undefined
                    );
                  }
                }}
                placeholder="Jump to Bookings, My Payments, Digital Pass, Map, AI..."
                aria-label="Search any page or feature"
                className="flex-1 text-sm text-[#111827] placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickJumpOpen(false)}
                aria-label="Close quick jump"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredQuickJump.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No CapeSafe Connect 360 feature matched &ldquo;{quickJumpQuery}&rdquo;.
                </p>
              ) : (
                filteredQuickJump.map((dest, idx) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() =>
                      handleNavigate(
                        dest.section,
                        dest.dashboardTab ? { dashboardTab: dest.dashboardTab } : undefined
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      idx === quickJumpIndex ? 'bg-[#EFF6FF]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111827]">{dest.label}</p>
                      <p className="truncate text-[11px] text-slate-500">{dest.description}</p>
                    </div>
                    <span className="font-mono text-[11px] text-[#1D4ED8] whitespace-nowrap shrink-0">
                      {dest.group}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2 sm:px-6 sm:py-3 md:sticky md:top-0 md:z-30">
          <div className="mx-auto flex max-w-[1440px] 2xl:max-w-[1640px] items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 md:hidden shrink-0"
                aria-label="Open all 15 features menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {activeSection !== 'dashboard' && (
                <button
                  type="button"
                  onClick={() =>
                    canGoBack && onGoBack
                      ? onGoBack()
                      : handleNavigate('dashboard', { dashboardTab: 'overview' })
                  }
                  className="inline-flex min-h-[40px] sm:min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                  <span className="hidden sm:inline">{canGoBack ? 'Back' : 'Dashboard'}</span>
                </button>
              )}

              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard', { dashboardTab: 'overview' })}
                  className="font-medium text-slate-600 hover:text-[#111827] whitespace-nowrap hidden sm:inline"
                >
                  {ROLE_LABELS[effectiveRole].short}
                </button>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 hidden sm:inline" aria-hidden="true" />
                <span className="truncate font-semibold text-[#111827]">
                  {activeSection === 'dashboard' ? ROLE_LABELS[effectiveRole].dashboardTitle : currentNav.label}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQuickJumpOpen(true)}
                className="inline-flex min-h-[40px] sm:min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-[#1D4ED8] hover:text-[#111827] transition-colors whitespace-nowrap shrink-0"
                title="Open Quick Jump (Ctrl+K or Cmd+K)"
                aria-label="Quick Jump navigation search"
              >
                <Search className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                <span className="hidden sm:inline">Jump to...</span>
                <kbd className="hidden xl:inline font-mono text-[10px] text-slate-500">⌘K</kbd>
              </button>

              {canSwitchPortals && (
                <>
                  {/* Compact Role Selector on Tablet (768px–1023px) */}
                  <select
                    aria-label="Switch workspace portal"
                    value={effectiveRole}
                    onChange={(e) => {
                      onSwitchRole(e.target.value as UserRole);
                      onSelectSection('dashboard', { dashboardTab: 'overview' });
                    }}
                    className="hidden md:block xl:hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-[#111827]"
                  >
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r].short}
                      </option>
                    ))}
                  </select>

                  {/* Full Segmented Role Switcher on Large Screens (1280px+) */}
                  <div className="hidden xl:flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          onSwitchRole(r);
                          onSelectSection('dashboard', { dashboardTab: 'overview' });
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                          effectiveRole === r
                            ? 'bg-[#111827] text-white'
                            : 'text-slate-600 hover:text-[#111827]'
                        }`}
                      >
                        {ROLE_LABELS[r].short}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="hidden sm:block">
                <PWAInstallButton variant="subtle" />
              </div>
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                aria-label="Open Cape Town Emergency Contacts 10111"
                className="inline-flex min-h-[40px] sm:min-h-[34px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>10111</span>
                <span className="hidden xl:inline font-semibold">Emergency</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('check-in')}
                className="min-h-[40px] sm:min-h-[34px] rounded-lg bg-[#1D4ED8] px-3 sm:px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">Check-In</span>
                <span className="hidden sm:inline">Quick Check-In</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          className={`flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 2xl:px-10 md:pb-10 ${
            effectiveRole === 'tourist' ? 'pb-20' : 'pb-8'
          }`}
        >
          <div className="mx-auto max-w-[1440px] 2xl:max-w-[1640px] space-y-5 sm:space-y-6">
            {user.authMode === 'firebase' && user.emailVerified === false && (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">Email Verification Required for Cloud Writes</p>
                    <p className="mt-0.5">
                      Verify your email address ({user.email}) via the link sent to your inbox to sync changes to Firestore.
                      {verificationMsg ? ` ${verificationMsg}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onResendVerification && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onResendVerification();
                        setVerificationMsg('Verification email resent.');
                      }}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                    >
                      Resend Email
                    </button>
                  )}
                  {onRefreshVerification && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onRefreshVerification();
                        setVerificationMsg('Status checked.');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B] whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      I&apos;ve Verified
                    </button>
                  )}
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Responsive Mobile Bottom Navigation (Tourist Experience on Mobile < 768px) */}
      {effectiveRole === 'tourist' && (
        <nav
          aria-label="Mobile tourist quick navigation"
          className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe md:hidden"
        >
          {mobileQuickItems.map((id) => {
            const item = NAV_ITEMS.find((n) => n.id === id)!;
            const Icon = item.icon;
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  handleNavigate(id, id === 'dashboard' ? { dashboardTab: 'overview' } : undefined)
                }
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                  active ? 'text-[#1D4ED8]' : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="truncate max-w-full px-1">{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-600 hover:text-[#111827]"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            <span>All (15)</span>
          </button>
        </nav>
      )}

      <EmergencyContactsModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        user={user}
        trustedContacts={trustedContacts}
        onNavigate={(sec) => handleNavigate(sec)}
      />
    </div>
  );
};
