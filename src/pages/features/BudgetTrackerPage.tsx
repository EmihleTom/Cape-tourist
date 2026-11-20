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
  const [budgetError, setBudgetError] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [syncingBookings, setSyncingBookings] = useState(false);

  const totalSpent = expenses.reduce((sum, e) => sum + e.amountZar, 0);
  const remaining = Math.max(0, targetBudgetZar - totalSpent);
  const overBudget = totalSpent > targetBudgetZar;
  const utilizationPct = Math.min(100, Math.round((totalSpent / Math.max(1, targetBudgetZar)) * 100));

  const confirmedBookings = bookings.filter(
    (b) =>
      b.status === 'Confirmed' &&
      b.paymentStatus !== 'Unpaid' &&
      b.paymentStatus !== 'Failed' &&
      b.paymentStatus !== 'Refunded'
  );
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
    setBudgetError('');
    setSyncMessage('');
    const numeric = Number(amountZar);
    if (!description.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      setBudgetError('Enter an expense description and a positive ZAR amount.');
      return;
    }
    setSubmittingExpense(true);
    try {
      await onAddExpense({
        date: expenseDate || '2026-11-15',
        description: description.trim(),
        category,
        amountZar: Math.max(1, Math.min(1000000, Math.round(numeric))),
        paymentMethod,
      });
      setDescription('');
      setAmountZar('');
      setSyncMessage('Expense saved to travel ledger.');
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : 'Unable to save expense.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleSyncConfirmedBookings = async () => {
    if (unsyncedBookings.length === 0) return;
    setBudgetError('');
    setSyncMessage('');
    setSyncingBookings(true);
    try {
      for (const bk of unsyncedBookings) {
        const mappedCat: BudgetExpense['category'] =
          bk.offeringType === 'Accommodation'
            ? 'Accommodation'
            : bk.offeringType === 'Transport'
            ? 'Transport'
            : 'Tours & Passes';
        const settledAmt =
          typeof bk.paidAmountZar === 'number' && bk.paidAmountZar > 0
            ? bk.paidAmountZar
            : bk.priceZar;
        await onAddExpense({
          date: bk.date || '2026-11-15',
          description: `${bk.title} (${bk.providerName})`,
          category: mappedCat,
          amountZar: Math.max(1, Math.min(1000000, Math.round(settledAmt))),
          paymentMethod: bk.paymentMethod || 'Confirmed Booking',
          bookingId: bk.id,
        });
      }
      setSyncMessage(`Synced ${unsyncedBookings.length} confirmed booking(s) to your ZAR ledger.`);
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : 'Unable to import confirmed bookings.');
    } finally {
      setSyncingBookings(false);
    }
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

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="font-display text-2xl font-bold text-[#111827]">
          Cape Town Travel Budget &amp; Expense Ledger
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Track ZAR trip expenses, compare category spend against your target ceiling, and import confirmed reservations.
        </p>
      </div>

      {/* Budget KPI Cards + Progress */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Total Logged Spend</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-[#111827]">
            R {totalSpent.toLocaleString('en-ZA')}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all ${overBudget ? 'bg-red-600' : 'bg-[#1D4ED8]'}`}
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
            <span className="font-display text-lg font-bold text-[#111827]">R</span>
            <input
              id="budget-target"
              type="number"
              min={500}
              step={500}
              value={targetBudgetZar}
              onChange={(e) => setTargetBudgetZar(Math.max(500, Number(e.target.value) || 500))}
              className="w-full rounded-lg border border-slate-300 px-3 py-1 font-display text-xl font-bold tabular-nums text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
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
        <div className="flex flex-col gap-3 rounded-xl border border-[#1D4ED8]/30 bg-[#EFF6FF] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs text-[#111827]">
            <CalendarCheck className="h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
            <span>
              <strong>{unsyncedBookings.length} Confirmed Paid Booking(s)</strong> (totalling{' '}
              <span className="font-mono font-bold">
                R{' '}
                {unsyncedBookings
                  .reduce(
                    (s, b) =>
                      s +
                      (typeof b.paidAmountZar === 'number' && b.paidAmountZar > 0
                        ? b.paidAmountZar
                        : b.priceZar),
                    0
                  )
                  .toLocaleString('en-ZA')}
              </span>
              ) are not yet imported into your expense ledger.
            </span>
          </div>
          <button
            type="button"
            disabled={syncingBookings}
            onClick={handleSyncConfirmedBookings}
            className="rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {syncingBookings ? 'Importing...' : 'Import Confirmed Bookings'}
          </button>
        </div>
      )}

      {syncMessage && (
        <p role="status" className="text-xs font-medium text-[#15803D]">
          {syncMessage}
        </p>
      )}
      {budgetError && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {budgetError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 space-y-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#111827]">Log Trip Expense</h2>
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-cat" className="block text-xs font-semibold text-slate-700">
                  Category
                </label>
                <select
                  id="exp-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BudgetExpense['category'])}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                  max={1000000}
                  value={amountZar}
                  onChange={(e) => setAmountZar(e.target.value)}
                  placeholder="250"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-date" className="block text-xs font-semibold text-slate-700">
                  Date
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
              disabled={submittingExpense}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#1D4ED8] py-2.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {submittingExpense ? 'Saving...' : 'Add Expense'}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <p className="text-xs font-semibold text-[#111827]">Category Breakdown</p>
            {categoryTotals.map((row) => (
              <div key={row.cat} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{row.cat}</span>
                <span className="font-mono font-semibold tabular-nums text-[#111827]">
                  R {row.total.toLocaleString('en-ZA')}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-base font-bold text-[#111827]">
              Expense Ledger ({visibleExpenses.length})
            </h2>
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
              {(['All', 'Accommodation', 'Tours & Passes', 'Transport', 'Dining'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={categoryFilter === cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`min-h-[34px] shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-[#111827] text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-[#111827]'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Mobile Card Ledger */}
          <div className="md:hidden divide-y divide-slate-200">
            {visibleExpenses.map((exp) => (
              <div key={exp.id} className="flex items-start justify-between gap-3 p-4 text-xs">
                <div className="space-y-1 min-w-0">
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {exp.date} · {exp.category}
                  </p>
                  <p className="text-sm font-bold text-[#111827]">{exp.description}</p>
                  <p className="text-slate-600">{exp.paymentMethod}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="font-mono text-sm font-bold tabular-nums text-[#111827]">
                    R {exp.amountZar.toLocaleString('en-ZA')}
                  </span>
                  {onDeleteExpense && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBudgetError('');
                        try {
                          await onDeleteExpense(exp.id);
                        } catch (err) {
                          setBudgetError(
                            err instanceof Error ? err.message : 'Unable to delete expense.'
                          );
                        }
                      }}
                      aria-label={`Delete ${exp.description}`}
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
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
                    <td className="px-5 py-3 font-medium text-[#111827]">{exp.description}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{exp.category}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{exp.paymentMethod}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#111827]">
                      R {exp.amountZar.toLocaleString('en-ZA')}
                    </td>
                    {onDeleteExpense && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            setBudgetError('');
                            try {
                              await onDeleteExpense(exp.id);
                            } catch (err) {
                              setBudgetError(
                                err instanceof Error ? err.message : 'Unable to delete expense.'
                              );
                            }
                          }}
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
