import React, { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import type { NotificationItem } from '@/src/types/app';

interface NotificationsPageProps {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
}) => {
  const [filter, setFilter] = useState<'All' | NotificationItem['category']>('All');

  const visible = notifications.filter((n) => filter === 'All' || n.category === filter);

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Demonstration alert inbox — push notifications activate with Firebase Cloud Messaging" />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Notifications</h1>
            <p className="text-xs text-slate-600">
              Safety corridor updates, check-in reminders, and booking confirmations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap"
        >
          <CheckCheck className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
          Mark All Read
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {(['All', 'Safety', 'Booking', 'Transport', 'System'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === cat ? 'bg-[#0B1F3A] text-white' : 'text-slate-600 hover:text-[#0B1F3A]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {visible.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
              item.read ? 'bg-white' : 'bg-[#F0FDFA]/60'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-[#0D9488]">{item.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{item.timestamp}</span>
                {!item.read && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#0B1F3A]">Unread</span>
                  </>
                )}
              </div>
              <h2 className="mt-1 font-display text-sm font-bold text-[#0B1F3A]">{item.title}</h2>
              <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
            </div>

            {!item.read && (
              <button
                type="button"
                onClick={() => onMarkRead(item.id)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Mark Read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
