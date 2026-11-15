import React, { useState } from 'react';
import { Accessibility, Bus, PlusCircle, Search, Wind } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import type {
  CapeTownWeather,
  NavSectionId,
  ProviderListing,
  TransportRoute,
} from '@/src/types/app';

interface TransportPageProps {
  routes: TransportRoute[];
  transportOfferings?: ProviderListing[];
  weather?: CapeTownWeather;
  onAddRouteToTrip?: (route: TransportRoute) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

export const TransportPage: React.FC<TransportPageProps> = ({
  routes,
  transportOfferings = [],
  weather,
  onAddRouteToTrip,
  onNavigate,
}) => {
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<'All' | TransportRoute['service']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);

  const visible = routes.filter((r) => {
    const matchesAccessible = !accessibleOnly || r.accessible;
    const matchesService = serviceFilter === 'All' || r.service === serviceFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      r.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.corridor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAccessible && matchesService && matchesQuery;
  });

  const handleAddToTrip = async (route: TransportRoute) => {
    if (!onAddRouteToTrip) return;
    await onAddRouteToTrip(route);
    setAddedId(route.id);
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Demonstration MyCiTi, shuttle, and rail intervals paired with bookable accredited transport operators" />

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Cape Town Transport Information
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            MyCiTi rapid bus corridors, Table Mountain shuttles, daylight coastal rail, and verified e-hailing pickup bays.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAccessibleOnly((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            accessibleOnly
              ? 'border-[#0D9488] bg-[#F0FDFA] text-[#0D9488]'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Accessibility className="h-4 w-4" aria-hidden="true" />
          {accessibleOnly ? 'Step-Free Transit Only: On' : 'Filter Step-Free Transit'}
        </button>
      </div>

      {/* Weather Impact on Mountain & Coastal Shuttles */}
      {weather && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs">
          <div className="flex items-center gap-2.5">
            <Wind className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
            <span>
              <strong className="text-[#0B1F3A]">Corridor Wind Check:</strong> {weather.temperatureC}°C · Wind {weather.windSpeedKmh} km/h (Gusts {weather.windGustsKmh} km/h)
            </span>
          </div>
          <StatusText
            label={`Table Mountain Shuttle / Cableway Risk: ${weather.cablewayRisk}`}
            tone={
              weather.cablewayRisk === 'Low'
                ? 'nominal'
                : weather.cablewayRisk === 'Moderate'
                ? 'advisory'
                : 'alert'
            }
          />
        </div>
      )}

      {/* Search & Service Filter */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search route or corridor (e.g., Airport, Camps Bay)..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              'All',
              'MyCiTi Rapid Bus',
              'Table Mountain Shuttle',
              'Metrorail Southern Line',
              'Verified E-Hailing Zone',
            ] as const
          ).map((svc) => (
            <button
              key={svc}
              type="button"
              onClick={() => setServiceFilter(svc)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                serviceFilter === svc
                  ? 'bg-[#0B1F3A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              {svc === 'All' ? 'All Services' : svc}
            </button>
          ))}
        </div>
      </div>

      {/* Transit Schedules Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Route &amp; Corridor</th>
                <th className="px-5 py-3">Frequency</th>
                <th className="px-5 py-3">Fare (ZAR)</th>
                <th className="px-5 py-3">Access</th>
                <th className="px-5 py-3">Status</th>
                {onAddRouteToTrip && <th className="px-5 py-3 text-right">Itinerary</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((route) => (
                <tr key={route.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 font-semibold text-[#0B1F3A] whitespace-nowrap">
                      <Bus className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
                      {route.service}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#0B1F3A]">{route.routeName}</p>
                    <p className="text-xs text-slate-500">{route.corridor}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                    {route.frequency}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-800">
                    {route.fareZar}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">
                    {route.accessible ? 'Level Boarding' : 'Steps at Platform'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusText
                      label={route.status}
                      tone={route.status === 'On Schedule' ? 'nominal' : 'advisory'}
                    />
                  </td>
                  {onAddRouteToTrip && (
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleAddToTrip(route)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#0D9488] bg-[#F0FDFA] px-2.5 py-1 text-xs font-semibold text-[#0F766E] hover:bg-teal-100 transition-colors whitespace-nowrap"
                      >
                        <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {addedId === route.id ? 'Added to Trips' : 'Add to Trips'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bookable Private / Accredited Transport Offerings */}
      {transportOfferings.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                Bookable Accredited Transport &amp; Shuttles
              </h2>
              <p className="text-xs text-slate-500">
                Reserve verified transport via Smart Bookings and combine confirmed rides into My Trips.
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('bookings')}
                className="rounded-lg bg-[#0D9488] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap"
              >
                Open Smart Bookings
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {transportOfferings.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#0B1F3A]">{item.experienceTitle}</p>
                  <p className="text-slate-600">
                    {item.providerName} · {item.zone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-[#0B1F3A] tabular-nums">
                    R {item.priceZar.toLocaleString('en-ZA')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    per {(item.durationUnit || 'days').slice(0, -1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
