import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  RefreshCw,
  X,
} from 'lucide-react';
import { BrandMark } from '@/src/components/common/BrandMark';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { PWAInstallButton } from '@/src/components/pwa/PWAInstallButton';
import { NAV_GROUPS, NAV_ITEMS, ROLE_LABELS } from '@/src/data/navigation';
import type { DemoUser, NavSectionId, UserRole } from '@/src/types/app';

interface AppShellProps {
  user: DemoUser;
  activePortalRole?: UserRole;
  activeSection: NavSectionId;
  unreadNotifications: number;
  onSelectSection: (section: NavSectionId) => void;
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
  onSelectSection,
  onSwitchRole,
  onResendVerification,
  onRefreshVerification,
  onGoLanding,
  onSignOut,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState('');

  const effectiveRole: UserRole = activePortalRole ?? user.role;
  const currentNav = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0];
  const mobileQuickItems: NavSectionId[] = ['dashboard', 'explore', 'safety', 'check-in'];
  const canSwitchPortals = user.authMode !== 'firebase' || user.role === 'admin';

  const handleNavigate = (id: NavSectionId) => {
    onSelectSection(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#0B1F3A] text-slate-100">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <button
          type="button"
          onClick={onGoLanding}
          className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 rounded-md"
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
      <div className="border-b border-white/10 px-4 py-3.5">
        {canSwitchPortals ? (
          <>
            <label
              htmlFor="sidebar-role-select"
              className="block text-[11px] font-medium text-slate-300 mb-1.5"
            >
              {user.authMode === 'firebase' ? 'Admin Portal View' : 'Demo Workspace Portal'}
            </label>
            <select
              id="sidebar-role-select"
              value={effectiveRole}
              onChange={(e) => {
                onSwitchRole(e.target.value as UserRole);
                onSelectSection('dashboard');
              }}
              className="w-full rounded-lg border border-white/15 bg-[#102A43] px-3 py-2 text-xs font-medium text-white focus:border-teal-400 focus:outline-none"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((roleKey) => (
                <option key={roleKey} value={roleKey}>
                  {ROLE_LABELS[roleKey].dashboardTitle}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div>
            <p className="text-[11px] font-medium text-slate-300">Assigned Access Role</p>
            <p className="mt-0.5 text-xs font-semibold text-teal-300">
              {ROLE_LABELS[effectiveRole].dashboardTitle}
            </p>
          </div>
        )}
      </div>

      {/* Complete 15-feature Navigation */}
      <nav aria-label="Primary application navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const groupItems = NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div key={group}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-teal-300/90">
                {group}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  const showUnread = item.id === 'notifications' && unreadNotifications > 0;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-[#0D9488] text-white'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {showUnread && (
                          <span className="ml-2 font-mono text-[11px] tabular-nums text-teal-200">
                            {unreadNotifications}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="border-t border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/15 bg-[#102A43] shrink-0">
            {user.avatarUrl ? (
              <ImageWithFallback src={user.avatarUrl} alt={user.name} />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xs font-bold text-teal-300">
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

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {renderSidebarContent()}
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

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:sticky lg:top-0 lg:z-30">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden shrink-0"
                aria-label="Open all 15 features menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard')}
                  className="font-medium text-slate-600 hover:text-[#0B1F3A] whitespace-nowrap"
                >
                  {ROLE_LABELS[effectiveRole].short}
                </button>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate font-semibold text-[#0B1F3A]">
                  {activeSection === 'dashboard' ? ROLE_LABELS[effectiveRole].dashboardTitle : currentNav.label}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {canSwitchPortals && (
                <div className="hidden md:flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        onSwitchRole(r);
                        onSelectSection('dashboard');
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        effectiveRole === r
                          ? 'bg-[#0B1F3A] text-white'
                          : 'text-slate-600 hover:text-[#0B1F3A]'
                      }`}
                    >
                      {ROLE_LABELS[r].short}
                    </button>
                  ))}
                </div>
              )}
              <PWAInstallButton variant="subtle" />
              <button
                type="button"
                onClick={() => handleNavigate('check-in')}
                className="rounded-lg bg-[#0D9488] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap shrink-0"
              >
                Quick Check-In
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-7xl space-y-6">
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
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#102A43] whitespace-nowrap"
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

      {/* Responsive Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-slate-200 bg-white lg:hidden"
      >
        {mobileQuickItems.map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavigate(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-[#0D9488]' : 'text-slate-600 hover:text-[#0B1F3A]'
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
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-600 hover:text-[#0B1F3A]"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          <span>All (15)</span>
        </button>
      </nav>
    </div>
  );
};
