import React, { useState } from 'react';
import {
  Camera,
  CloudSun,
  Info,
  MapPin,
  Megaphone,
  Navigation,
  PhoneCall,
  Send,
  ShieldAlert,
  Wind,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { CapeTownMap } from '@/src/components/map/CapeTownMap';
import { CAPE_TOWN_DESTINATION_INFO } from '@/src/data/demoData';
import { storageService } from '@/src/services/firebase/storageService';
import type {
  CapeTownWeather,
  DemoUser,
  DestinationAnnouncement,
  IncidentCategory,
  SafetyAdvisory,
} from '@/src/types/app';

interface SafetyCentrePageProps {
  user: DemoUser;
  advisories: SafetyAdvisory[];
  announcements: DestinationAnnouncement[];
  weather: CapeTownWeather;
  onReportIncident: (
    advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>
  ) => Promise<void> | void;
  onRevokeIncidentLocation: (incidentId: string) => Promise<void> | void;
}

const INCIDENT_CATEGORIES: IncidentCategory[] = [
  'Trail Hazard',
  'Coastal / Marine',
  'Transport & Transit',
  'Theft / Suspicious Activity',
  'Medical / Rescue',
  'Infrastructure / Lighting',
  'Safety Advisory',
];

const CAPE_TOWN_ZONES = [
  'Table Mountain Summit & Platteklip Gorge',
  "Lion's Head Spiral Trail",
  'V&A Waterfront & Sea Point Corridor',
  'Bo-Kaap & City Bowl',
  'Kirstenbosch & Newlands',
  'Muizenberg to Fish Hoek Coastline',
  "Simon's Town & Boulders Beach",
  "Chapman's Peak & Hout Bay",
];

export const SafetyCentrePage: React.FC<SafetyCentrePageProps> = ({
  user,
  advisories,
  announcements,
  weather,
  onReportIncident,
  onRevokeIncidentLocation,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'All' | SafetyAdvisory['severity']>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | IncidentCategory>('All');
  const [showMap, setShowMap] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Incident Report Form State
  const [category, setCategory] = useState<IncidentCategory>('Trail Hazard');
  const [zone, setZone] = useState(CAPE_TOWN_ZONES[0]);
  const [severity, setSeverity] = useState<SafetyAdvisory['severity']>('Advisory');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [locationConsent, setLocationConsent] = useState(false);
  const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState('');

  const handleRevokeLocation = async (incidentId: string) => {
    setRevokeError('');
    setRevokingId(incidentId);
    try {
      await onRevokeIncidentLocation(incidentId);
    } catch (err) {
      setRevokeError(
        err instanceof Error ? err.message : 'Unable to revoke GPS consent for this incident.'
      );
    } finally {
      setRevokingId(null);
    }
  };

  const filtered = advisories.filter((adv) => {
    const matchesSeverity = severityFilter === 'All' || adv.severity === severityFilter;
    const matchesCategory = categoryFilter === 'All' || adv.category === categoryFilter;
    return matchesSeverity && matchesCategory;
  });

  const activeAnnouncements = announcements
    .filter((a) => a.active)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const handleCaptureGps = () => {
    setLocationStatus('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('Browser GPS unavailable; report will use your selected precinct.');
      return;
    }
    setLocationStatus('Requesting browser GPS fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturedCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
        setLocationConsent(true);
        setLocationStatus(
          `GPS captured (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}) with consent.`
        );
      },
      () => {
        setLocationStatus('GPS permission declined or timed out; report will use precinct name only.');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage('');
    setSubmitError('');

    if (title.trim().length < 4 || summary.trim().length < 8) {
      setSubmitError('Please provide an incident headline (min 4 characters) and description (min 8 characters).');
      return;
    }

    if (user.authMode === 'firebase' && !user.emailVerified) {
      setSubmitError('Please verify your email address to submit live incidents to Safety Operations.');
      return;
    }

    setSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      if (photoFile && user.authMode === 'firebase' && user.emailVerified) {
        attachmentUrl = await storageService.uploadIncidentPhoto(user.id, photoFile);
      }

      const shareExactLocation = Boolean(locationConsent && capturedCoords);
      await onReportIncident({
        reporterId: user.id,
        category,
        zone,
        severity,
        title: title.trim(),
        summary: summary.trim(),
        source:
          user.authMode === 'firebase' && user.emailVerified
            ? `${user.name} (Verified Report)`
            : `${user.name} (Demo Report)`,
        status: 'Open',
        ...(attachmentUrl ? { attachmentUrl } : {}),
        locationConsent: shareExactLocation,
        ...(shareExactLocation && capturedCoords
          ? {
              sharedLat: capturedCoords.lat,
              sharedLng: capturedCoords.lng,
              locationLabel: `${zone} (Consented GPS)`,
            }
          : {}),
      });

      setTitle('');
      setSummary('');
      setPhotoFile(null);
      setLocationConsent(false);
      setCapturedCoords(null);
      setLocationStatus('');
      setSubmitMessage(
        user.authMode === 'firebase' && user.emailVerified
          ? 'Incident saved to Cloud Firestore and routed to Safety Management.'
          : 'Incident added to demonstration safety feed.'
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit incident report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Pre-loaded precinct advisories are demo data; submitted incidents, weather, and official announcements reflect live feeds when active" />

      {/* Emergency Dispatch Reference */}
      <section className="rounded-xl border border-slate-200 bg-[#0B1F3A] p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-teal-300">24/7 Emergency &amp; Incident Desk</p>
            <h1 className="mt-1 font-display text-2xl font-bold">Cape Town Safety Centre</h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl">
              Submit field incidents with optional photos and consented GPS, check live Cape Peninsula weather, and dial official emergency services directly for urgent rescues.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/15 bg-[#102A43] px-4 py-3">
              <p className="text-[11px] text-slate-300">City Emergency</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-base font-bold tabular-nums text-white">
                <PhoneCall className="h-4 w-4 text-[#14B8A6]" aria-hidden="true" />
                107 / 112
              </p>
            </div>
            <div className="rounded-lg border border-white/15 bg-[#102A43] px-4 py-3">
              <p className="text-[11px] text-slate-300">Mountain Rescue</p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-white">021 937 0300</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-[#102A43] px-4 py-3">
              <p className="text-[11px] text-slate-300">NSRI Sea Rescue</p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-white">087 094 9774</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Weather + Official Destination Announcements */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                Cape Town Conditions
              </h2>
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {weather.dataOrigin === 'live' ? 'Live · Open-Meteo' : 'Demo Snapshot'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <div>
              <p className="text-[11px] text-slate-500">Temp</p>
              <p className="font-display text-lg font-bold tabular-nums text-[#0B1F3A]">
                {weather.temperatureC}°C
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Wind</p>
              <p className="font-display text-lg font-bold tabular-nums text-[#0B1F3A]">
                {weather.windSpeedKmh} <span className="text-xs font-normal">km/h</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Gusts</p>
              <p className="font-display text-lg font-bold tabular-nums text-[#0B1F3A]">
                {weather.windGustsKmh} <span className="text-xs font-normal">km/h</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">{weather.conditionLabel}</span>
            <StatusText
              label={`Cableway Wind Risk: ${weather.cablewayRisk}`}
              tone={
                weather.cablewayRisk === 'Low'
                  ? 'nominal'
                  : weather.cablewayRisk === 'Moderate'
                  ? 'advisory'
                  : 'alert'
              }
            />
          </div>
          <p className="text-[11px] text-slate-500">Observed: {weather.observedAtLabel}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                Destination Announcements
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {activeAnnouncements.length} active
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-200">
            {activeAnnouncements.slice(0, 3).map((ann) => (
              <div key={ann.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0B1F3A]">{ann.title}</span>
                    {ann.pinned && (
                      <span className="rounded bg-[#F0FDFA] px-1.5 py-0.5 text-[10px] font-semibold text-[#0F766E]">
                        Pinned
                      </span>
                    )}
                  </div>
                  <StatusText
                    label={ann.priority}
                    tone={
                      ann.priority === 'Urgent'
                        ? 'alert'
                        : ann.priority === 'Advisory'
                        ? 'advisory'
                        : 'nominal'
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{ann.body}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {ann.category} · {ann.zone} · {ann.updatedAtLabel}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Report a Safety Incident + Incident Map */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Report a Safety Incident
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Non-emergency reports are saved to Firestore and reviewed by Safety Management and Administrators. For immediate life-safety emergencies, call 107 / 112.
          </p>

          <form onSubmit={handleSubmitIncident} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="inc-category" className="block text-xs font-semibold text-slate-700">
                  Category
                </label>
                <select
                  id="inc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  {INCIDENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="inc-severity" className="block text-xs font-semibold text-slate-700">
                  Severity
                </label>
                <select
                  id="inc-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as SafetyAdvisory['severity'])}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="Nominal">Nominal (FYI)</option>
                  <option value="Advisory">Advisory (Caution)</option>
                  <option value="Elevated">Elevated (Urgent Hazard)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="inc-zone" className="block text-xs font-semibold text-slate-700">
                Cape Town Precinct
              </label>
              <select
                id="inc-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              >
                {CAPE_TOWN_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inc-title" className="block text-xs font-semibold text-slate-700">
                Incident Headline
              </label>
              <input
                id="inc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Loose rockfall near Contour Path junction"
                maxLength={160}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="inc-summary" className="block text-xs font-semibold text-slate-700">
                Description
              </label>
              <textarea
                id="inc-summary"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Describe what happened, landmark proximity, and whether path access is blocked..."
                maxLength={800}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            {/* Optional Photo & Consented GPS */}
            <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100">
                  <Camera className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
                  {photoFile ? photoFile.name : 'Optional Photo (Storage)'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleCaptureGps}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#0D9488] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F766E] hover:bg-[#F0FDFA]"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  Capture GPS
                </button>
              </div>

              <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(e) => setLocationConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
                />
                <span>
                  I explicitly consent to share my captured GPS coordinates with CapeSafe Safety Management &amp; Administrators for this report (revocable anytime).
                </span>
              </label>

              {locationStatus && (
                <p className="font-mono text-[11px] text-slate-600">{locationStatus}</p>
              )}
              {locationConsent && !capturedCoords && (
                <p className="text-[11px] text-amber-800">
                  Click &ldquo;Capture GPS&rdquo; above if you want exact device coordinates attached; otherwise only the precinct name will be recorded.
                </p>
              )}
            </div>

            {submitMessage && (
              <p role="status" className="text-xs font-medium text-[#15803D]">{submitMessage}</p>
            )}
            {submitError && (
              <p role="alert" className="text-xs font-medium text-red-700">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] py-2.5 text-xs font-semibold text-white hover:bg-[#102A43] disabled:opacity-60 transition-colors"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {submitting ? 'Submitting Report...' : 'Submit Safety Incident'}
            </button>
          </form>
        </section>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Safety Incident &amp; Corridor Map
            </h2>
            <button
              type="button"
              onClick={() => setShowMap((prev) => !prev)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
            >
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
          </div>
          {showMap && (
            <CapeTownMap
              incidents={filtered}
              userLocation={locationConsent && capturedCoords ? capturedCoords : null}
              selectedId={selectedIncidentId}
              onSelectMarker={(m) => setSelectedIncidentId(m.id)}
              heightClassName="h-[465px]"
              defaultLayers={{ attractions: false, businesses: false, incidents: true }}
            />
          )}
        </div>
      </div>

      {/* Filter & Advisories */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
            Precinct Conditions &amp; Reported Incidents
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by incident category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'All' | IncidentCategory)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] focus:border-[#0D9488] focus:outline-none"
          >
            <option value="All">All Categories</option>
            {INCIDENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(['All', 'Nominal', 'Advisory', 'Elevated'] as const).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={severityFilter === level}
                onClick={() => setSeverityFilter(level)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  severityFilter === level
                    ? 'bg-[#0B1F3A] text-white'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {revokeError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {revokeError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((adv) => {
          const isReporter = adv.reporterId === user.id;
          const hasConsentedCoords =
            adv.locationConsent === true &&
            typeof adv.sharedLat === 'number' &&
            typeof adv.sharedLng === 'number';

          return (
            <article
              key={adv.id}
              className={`rounded-xl border bg-white p-5 space-y-2.5 transition-colors ${
                selectedIncidentId === adv.id ? 'border-[#0D9488] ring-1 ring-[#0D9488]' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#0B1F3A]">{adv.category || 'Safety Advisory'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{adv.zone}</span>
                </div>
                <div className="flex items-center gap-2">
                  {adv.status && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {adv.status}
                    </span>
                  )}
                  <StatusText
                    label={adv.severity}
                    tone={
                      adv.severity === 'Nominal'
                        ? 'nominal'
                        : adv.severity === 'Advisory'
                        ? 'advisory'
                        : 'alert'
                    }
                  />
                </div>
              </div>

              <h3 className="font-display text-base font-bold text-[#0B1F3A]">{adv.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{adv.summary}</p>

              {adv.assignedOfficerName && (
                <p className="text-xs font-medium text-[#0B1F3A]">
                  Assigned Unit: <span className="text-[#0D9488]">{adv.assignedOfficerName}</span>
                </p>
              )}
              {adv.resolutionNotes && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
                  <strong className="text-[#0B1F3A]">Dispatch Note:</strong> {adv.resolutionNotes}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {adv.attachmentUrl && (
                  <a
                    href={adv.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-semibold text-[#0D9488] hover:underline"
                  >
                    View Field Photo Attachment
                  </a>
                )}
                {hasConsentedCoords && (
                  <button
                    type="button"
                    onClick={() => setSelectedIncidentId(adv.id)}
                    className="inline-flex items-center gap-1 text-xs font-mono text-[#0B1F3A] hover:text-[#0D9488]"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
                    {adv.sharedLat?.toFixed(4)}, {adv.sharedLng?.toFixed(4)}
                  </button>
                )}
                {hasConsentedCoords && isReporter && (
                  <button
                    type="button"
                    disabled={revokingId === adv.id}
                    onClick={() => void handleRevokeLocation(adv.id)}
                    className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                  >
                    {revokingId === adv.id ? 'Revoking GPS...' : 'Revoke GPS Consent'}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11px] text-slate-500">
                <span>
                  {adv.source} · {adv.dataOrigin === 'live' ? 'Live Firestore' : 'Demo'}
                </span>
                <span className="font-mono tabular-nums">{adv.updatedAt}</span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Cape Town Destination Info & Preparedness Guide */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
            Cape Town Destination Information &amp; Trail Readiness
          </h3>
        </div>
        <div className="grid gap-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          {CAPE_TOWN_DESTINATION_INFO.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <p className="font-semibold text-[#0B1F3A]">{item.title}</p>
              <p className="mt-1 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
          <Wind className="h-4 w-4 text-[#0D9488] shrink-0" aria-hidden="true" />
          <span>
            Aerial Cableway pauses when summit gusts exceed 50 km/h. Always swim between red-and-yellow flags and keep Tourist Check-In active on mountain trails.
          </span>
        </div>
      </section>
    </div>
  );
};
