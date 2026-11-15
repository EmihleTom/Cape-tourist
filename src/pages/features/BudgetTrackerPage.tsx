import React, { useEffect, useState } from 'react';
import { CalendarCheck, Plus, Trash2, Wallet } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import type { BookingItem, BudgetExpense, DemoUser } from '@/src/types/app';

interface BudgetTrackerPageProps {
  user: DemoUser;
  expenses: BudgetExpense[];
  bookings?: BookingItem[];
  onAddExpense: (expense: Omit<BudgetExpense, 'id' | 'dataOrigin'>) => Promise<void> | void;
  onDeleteExpense?: (id: string) => Promise<void> | void;
}

export const BudgetTrackerPage: React.FC<BudgetTrackerPageProps> = ({
  user,
  expenses,
  bookings = [],
  onAddExpense,
  onDeleteExpense,
}) => {
  const storageKey = `capesafe_budget_target_${user.id}`;
  const [targetBudgetZar, setTargetBudgetZar] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved && Number(saved) > 0 ? Number(saved) : 12000;
    } catch {
      return 12000;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(targetBudgetZar));
    } catch {
      // ignore storage errors
    }
  }, [storageKey, targetBudgetZar]);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BudgetExpense['category']>('Dining');
  const [amountZar, setAmountZar] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [expenseDate, setExpenseDate] = useState('2026-11-15');
  const [categoryFilter, setCategoryFilter] = useState<'All' | BudgetExpense['category']>('All');
  const [syncMessage, setSyncMessage] = useState('');

  const totalSpent = expenses.reduce((sum, e) => sum + e.amountZar, 0);
  const remaining = Math.max(0, targetBudgetZar - totalSpent);
  const overBudget = totalSpent > targetBudgetZar;
  const utilizationPct = Math.min(100, Math.round((totalSpent / Math.max(1, targetBudgetZar)) * 100));

  const confirmedBookings = bookings.filter((b) => b.status === 'Confirmed');
  const loggedBookingIds = new Set(expenses.map((e) => e.bookingId).filter(Boolean));
  const unsyncedBookings = confirmedBookings.filter((b) => !loggedBookingIds.has(b.id));

  const categoryTotals: Array<{ cat: BudgetExpense['category']; total: number }> = (
    ['Accommodation', 'Tours & Passes', 'Transport', 'Dining'] as const
  ).map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amountZar, 0),
  }));

  const visibleExpenses = expenses.filter(
    (e) => categoryFilter === 'All' || e.category === categoryFilter
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amountZar);
    if (!description.trim() || !numeric || numeric <= 0) return;
    await onAddExpense({
      date: expenseDate || '2026-11-15',
      description: description.trim(),
      category,
      amountZar: Math.round(numeric),
      paymentMethod,
    });
    setDescription('');
    setAmountZar('');
  };

  const handleSyncConfirmedBookings = async () => {
    if (unsyncedBookings.length === 0) return;
    for (const bk of unsyncedBookings) {
      const mappedCat: BudgetExpense['category'] =
        bk.offeringType === 'Accommodation'
          ? 'Accommodation'
          : bk.offeringType === 'Transport'
          ? 'Transport'
          : 'Tours & Passes';
      await onAddExpense({
        date: bk.date || '2026-11-15',
        description: `${bk.title} (${bk.providerName})`,
        category: mappedCat,
        amountZar: Math.max(1, Math.round(bk.priceZar)),
        paymentMethod: 'Confirmed Booking',
        bookingId: bk.id,
      });
    }
    setSyncMessage(`Synced ${unsyncedBookings.length} confirmed booking(s) to your ZAR ledger.`);
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase' && user.emailVerified
            ? 'Live Firestore ZAR Travel Ledger — add expenses or import confirmed Cape Town bookings'
            : 'Sample ZAR travel ledger — sign in with Firebase to persist expenses & booking totals'
        }
      />

      {/* Budget KPI Cards + Progress */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Total Logged Spend</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            R {totalSpent.toLocaleString('en-ZA')}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all ${overBudget ? 'bg-red-600' : 'bg-[#0D9488]'}`}
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{utilizationPct}% of planned budget</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <label htmlFor="budget-target" className="block text-xs text-slate-500">
            Planned Trip Budget (ZAR)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-display text-lg font-bold text-[#0B1F3A]">R</span>
            <input
              id="budget-target"
              type="number"
              min={500}
              step={500}
              value={targetBudgetZar}
              onChange={(e) => setTargetBudgetZar(Math.max(500, Number(e.target.value) || 500))}
              className="w-full rounded-lg border border-slate-300 px-3 py-1 font-display text-xl font-bold tabular-nums text-[#0B1F3A] focus:border-[#0D9488] focus:outline-none"
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Adjustable trip ceiling</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">
            {overBudget ? 'Over Planned Budget' : 'Remaining Balance'}
          </p>
          <p
            className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${
              overBudget ? 'text-red-700' : 'text-[#15803D]'
            }`}
          >
            {overBudget
              ? `-R ${(totalSpent - targetBudgetZar).toLocaleString('en-ZA')}`
              : `R ${remaining.toLocaleString('en-ZA')}`}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Across {expenses.length} recorded ZAR entries
          </p>
        </div>
      </div>

      {/* Sync Confirmed Bookings Banner */}
      {unsyncedBookings.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#0D9488]/30 bg-[#F0FDFA] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs text-[#0B1F3A]">
            <CalendarCheck className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden="true" />
            <span>
              <strong>{unsyncedBookings.length} Confirmed Booking(s)</strong> (totalling{' '}
              <span className="font-mono font-bold">
                R{' '}
                {unsyncedBookings
                  .reduce((s, b) => s + b.priceZar, 0)
                  .toLocaleString('en-ZA')}
              </span>
              ) are not yet imported into your expense ledger.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSyncConfirmedBookings}
            className="rounded-lg bg-[#0D9488] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap"
          >
            Import Confirmed Bookings
          </button>
        </div>
      )}

      {syncMessage && <p className="text-xs font-medium text-[#15803D]">{syncMessage}</p>}

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 space-y-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
            <h1 className="font-display text-base font-bold text-[#0B1F3A]">Log Trip Expense</h1>
          </div>

          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label htmlFor="exp-desc" className="block text-xs font-semibold text-slate-700">
                Description
              </label>
              <input
                id="exp-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Signal Hill Coffee & Pastries"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-cat" className="block text-xs font-semibold text-slate-700">
                  Category
                </label>
                <select
                  id="exp-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BudgetExpense['category'])}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="Accommodation">Accommodation</option>
                  <option value="Tours & Passes">Tours &amp; Passes</option>
                  <option value="Transport">Transport</option>
                  <option value="Dining">Dining</option>
                </select>
              </div>
              <div>
                <label htmlFor="exp-amt" className="block text-xs font-semibold text-slate-700">
                  Amount (ZAR)
                </label>
                <input
                  id="exp-amt"
                  type="number"
                  min={1}
                  value={amountZar}
                  onChange={(e) => setAmountZar(e.target.value)}
                  placeholder="250"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-date" className="block text-xs font-semibold text-slate-700">
                  Date
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="exp-method" className="block text-xs font-semibold text-slate-700">
                  Method
                </label>
                <select
                  id="exp-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="Card">Card</option>
                  <option value="Digital Wallet">Digital Wallet</option>
                  <option value="MyCiTi Card">MyCiTi Card</option>
                  <option value="Cash (ZAR)">Cash (ZAR)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Expense
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <p className="text-xs font-semibold text-[#0B1F3A]">Category Breakdown</p>
            {categoryTotals.map((row) => (
              <div key={row.cat} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{row.cat}</span>
                <span className="font-mono font-semibold tabular-nums text-[#0B1F3A]">
                  R {row.total.toLocaleString('en-ZA')}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Expense Ledger ({visibleExpenses.length})
            </h2>
            <div className="flex flex-wrap gap-1">
              {(['All', 'Accommodation', 'Tours & Passes', 'Transport', 'Dining'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-[#0B1F3A]'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount (ZAR)</th>
                  {onDeleteExpense && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs tabular-nums text-slate-600">
                      {exp.date}
                    </td>
                    <td className="px-5 py-3 font-medium text-[#0B1F3A]">{exp.description}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{exp.category}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{exp.paymentMethod}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#0B1F3A]">
                      R {exp.amountZar.toLocaleString('en-ZA')}
                    </td>
                    {onDeleteExpense && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          aria-label={`Delete ${exp.description}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
