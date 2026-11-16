import React, { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import type { NotificationItem } from '@/src/types/app';

interface NotificationsPageProps {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
}) => {
  const [filter, setFilter] = useState<'All' | NotificationItem['category']>('All');
  const [notifError, setNotifError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = notifications.filter((n) => filter === 'All' || n.category === filter);

  const handleMarkOne = async (id: string) => {
    setNotifError('');
    setBusyId(id);
    try {
      await onMarkRead(id);
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Unable to mark notification as read.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setNotifError('');
    setBusyId('all');
    try {
      await onMarkAllRead();
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Unable to mark all notifications as read.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="In-app alert inbox synced with your active session — mobile push delivery requires Firebase Cloud Messaging (not configured)" />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
          <div>
            <h1 className="font-display text-2xl font-bold text-[#111827]">Notifications</h1>
            <p className="text-xs text-slate-600">
              Safety corridor updates, check-in reminders, and booking confirmations.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busyId === 'all' || notifications.every((n) => n.read)}
          onClick={() => void handleMarkAll()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
        >
          <CheckCheck className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
          {busyId === 'all' ? 'Updating...' : 'Mark All Read'}
        </button>
      </div>

      {notifError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {notifError}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {(['All', 'Safety', 'Booking', 'Transport', 'System'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={filter === cat}
            onClick={() => setFilter(cat)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === cat ? 'bg-[#111827] text-white' : 'text-slate-600 hover:text-[#111827]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {visible.length === 0 ? (
          <p className="px-5 py-6 text-xs text-slate-500">
            No notifications in the {filter} category yet.
          </p>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                item.read ? 'bg-white' : 'bg-[#EFF6FF]/60'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#1D4ED8]">{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{item.timestamp}</span>
                  {!item.read && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#111827]">Unread</span>
                    </>
                  )}
                </div>
                <h2 className="mt-1 font-display text-sm font-bold text-[#111827]">{item.title}</h2>
                <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
              </div>

              {!item.read && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void handleMarkOne(item.id)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {busyId === item.id ? 'Updating...' : 'Mark Read'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
