import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type { RouteWaypoint } from '@/src/data/transportPillars';

interface AnimatedRoutePreviewProps {
  routeTitle: string;
  waypoints: RouteWaypoint[];
  totalDistanceKm: number;
  totalDriveMinutes: number;
  driverName?: string;
  vehicleLabel?: string;
  pickupCode?: string;
  timeBandLabel?: string;
  googleMapsUrl: string;
}

interface ProjectedPoint extends RouteWaypoint {
  x: number;
  y: number;
}

const SVG_WIDTH = 640;
const SVG_HEIGHT = 270;
const PAD_X = 64;
const PAD_Y = 44;

export const AnimatedRoutePreview: React.FC<AnimatedRoutePreviewProps> = ({
  routeTitle,
  waypoints,
  totalDistanceKm,
  totalDriveMinutes,
  driverName,
  vehicleLabel,
  pickupCode,
  timeBandLabel,
  googleMapsUrl,
}) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Reset playback cleanly when the selected route changes
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [routeTitle, waypoints.length]);

  useEffect(() => {
    if (!playing || prefersReducedMotion) return;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setProgress((prev) => {
        const next = prev + dt * 11 * speed;
        if (next >= 100) {
          setPlaying(false);
          return 100;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, speed, prefersReducedMotion]);

  // Project lat/lng waypoints deterministically onto clean 2D corridor viewport
  const projected: ProjectedPoint[] = useMemo(() => {
    if (waypoints.length === 0) return [];
    const lats = waypoints.map((w) => w.lat);
    const lngs = waypoints.map((w) => w.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.025, maxLat - minLat);
    const lngSpan = Math.max(0.035, maxLng - minLng);

    return waypoints.map((wp, idx) => {
      // Blend true geography with clean left-to-right readability so overlapping east-west corridors never collapse
      const geoX = (wp.lng - minLng) / lngSpan;
      const linearX = waypoints.length > 1 ? idx / (waypoints.length - 1) : 0.5;
      const blendedX = geoX * 0.45 + linearX * 0.55;
      const geoY = 1 - (wp.lat - minLat) / latSpan;

      return {
        ...wp,
        x: Math.round((PAD_X + blendedX * (SVG_WIDTH - PAD_X * 2)) * 10) / 10,
        y: Math.round((PAD_Y + (geoY * 0.72 + (idx % 2 === 0 ? 0.14 : 0.14)) * (SVG_HEIGHT - PAD_Y * 2)) * 10) / 10,
      };
    });
  }, [waypoints]);

  // Interpolate vehicle coordinate along piecewise polyline segments
  const vehiclePos = useMemo(() => {
    if (projected.length === 0) return { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2, activeIdx: 0 };
    if (projected.length === 1) return { x: projected[0].x, y: projected[0].y, activeIdx: 0 };

    const t = Math.min(1, Math.max(0, progress / 100));
    const totalSegments = projected.length - 1;
    const scaled = t * totalSegments;
    const segIdx = Math.min(totalSegments - 1, Math.floor(scaled));
    const localT = scaled - segIdx;

    const p0 = projected[segIdx];
    const p1 = projected[segIdx + 1];
    const x = p0.x + (p1.x - p0.x) * localT;
    const y = p0.y + (p1.y - p0.y) * localT;
    const activeIdx = localT >= 0.72 ? segIdx + 1 : segIdx;
    return { x, y, activeIdx };
  }, [projected, progress]);

  const activeWaypoint = projected[vehiclePos.activeIdx] || projected[0];
  const fullPolyline = projected.map((p) => `${p.x},${p.y}`).join(' ');

  const traversedPolyline = useMemo(() => {
    if (projected.length === 0) return '';
    const t = Math.min(1, Math.max(0, progress / 100));
    const totalSegments = Math.max(1, projected.length - 1);
    const segIdx = Math.min(totalSegments - 1, Math.floor(t * totalSegments));
    const points = projected.slice(0, segIdx + 1).map((p) => `${p.x},${p.y}`);
    points.push(`${vehiclePos.x.toFixed(1)},${vehiclePos.y.toFixed(1)}`);
    return points.join(' ');
  }, [projected, progress, vehiclePos]);

  const handleTogglePlay = () => {
    if (prefersReducedMotion) {
      // Step forward to next stop cleanly when user prefers reduced motion
      const stepPct = projected.length > 1 ? 100 / (projected.length - 1) : 100;
      setProgress((prev) => (prev >= 99 ? 0 : Math.min(100, Math.round(prev + stepPct))));
      return;
    }
    if (progress >= 100) {
      setProgress(0);
    }
    setPlaying((p) => !p);
  };

  const handleSelectStop = (idx: number) => {
    setPlaying(false);
    if (projected.length <= 1) {
      setProgress(0);
      return;
    }
    setProgress(Math.round((idx / (projected.length - 1)) * 100));
  };

  return (
    <section
      aria-label="Animated Route Playback and Stop Preview"
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-[#1D4ED8]">Animated Route Playback</span>
            <span>·</span>
            <span className="font-mono tabular-nums">
              {totalDistanceKm} km · ~{totalDriveMinutes} min drive
            </span>
            {timeBandLabel && (
              <>
                <span>·</span>
                <span className="font-medium text-[#111827]">{timeBandLabel}</span>
              </>
            )}
          </div>
          <h2 className="mt-0.5 font-display text-base font-bold text-[#111827] truncate">
            {routeTitle}
          </h2>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Navigation className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
          Open Turn-by-Turn Maps
        </a>
      </div>

      <div className="grid gap-0 lg:grid-cols-12">
        {/* Interactive SVG Route Map + Scrubber (7 cols) */}
        <div className="lg:col-span-7 border-b border-slate-200 lg:border-b-0 lg:border-r p-4 sm:p-5 space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC]">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-[210px] sm:h-[250px] block"
              role="img"
              aria-label={`Planned Cape Town route preview for ${routeTitle}`}
            >
              {/* Clean topographic grid lines */}
              <defs>
                <pattern id="kaap-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path
                    d="M 32 0 L 0 0 0 32"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="0.8"
                  />
                </pattern>
              </defs>
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#kaap-grid)" />

              {/* Unvisited planned corridor */}
              {fullPolyline && (
                <polyline
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="5"
                  strokeDasharray="7 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={fullPolyline}
                />
              )}

              {/* Active traversed path */}
              {traversedPolyline && (
                <polyline
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={traversedPolyline}
                />
              )}

              {/* Waypoint Nodes */}
              {projected.map((pt, idx) => {
                const isReached =
                  projected.length <= 1
                    ? true
                    : progress >= Math.round((idx / (projected.length - 1)) * 100) - 2;
                const isCurrent = vehiclePos.activeIdx === idx;
                return (
                  <g
                    key={pt.id}
                    className="cursor-pointer"
                    onClick={() => handleSelectStop(idx)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isCurrent ? 14 : 11}
                      fill={
                        pt.stopRole === 'pickup'
                          ? '#15803D'
                          : isReached
                          ? '#1D4ED8'
                          : '#FFFFFF'
                      }
                      stroke={isCurrent ? '#111827' : '#1D4ED8'}
                      strokeWidth={isCurrent ? 2.5 : 1.8}
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={
                        pt.stopRole === 'pickup' || isReached ? '#FFFFFF' : '#111827'
                      }
                    >
                      {idx + 1}
                    </text>
                    <text
                      x={pt.x}
                      y={idx % 2 === 0 ? pt.y - 18 : pt.y + 26}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="#111827"
                    >
                      {pt.zone.slice(0, 18)}
                    </text>
                  </g>
                );
              })}

              {/* Animated Vehicle Marker */}
              <g
                style={{
                  transform: `translate(${vehiclePos.x}px, ${vehiclePos.y}px)`,
                }}
              >
                <circle r="13" fill="#111827" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle r="4.5" fill="#60A5FA" />
              </g>
            </svg>

            {/* Vetted Vehicle Overlay Note */}
            {(driverName || vehicleLabel || pickupCode) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3.5 py-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#111827]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#15803D] shrink-0" aria-hidden="true" />
                  {driverName ? `${driverName} · ` : ''}
                  {vehicleLabel || 'Vetted Charter Vehicle'}
                </span>
                {pickupCode && (
                  <span className="font-mono font-bold text-[#111827]">
                    Code: {pickupCode}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Playback Controls & Scrubber (Mobile-friendly >=44px targets) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] whitespace-nowrap shrink-0"
            >
              {playing ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  Pause Route
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {prefersReducedMotion
                    ? 'Next Stop'
                    : progress >= 100
                    ? 'Replay Route'
                    : 'Play Route'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setProgress(0);
              }}
              aria-label="Restart route playback"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {speed}x Speed
            </button>

            <div className="flex-1 min-w-[140px] flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(progress)}
                aria-label="Route playback progress scrubber"
                onChange={(e) => {
                  setPlaying(false);
                  setProgress(Number(e.target.value));
                }}
                className="w-full accent-[#1D4ED8] cursor-pointer"
              />
              <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums w-9 text-right">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Active Stop Spotlight */}
          {activeWaypoint && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[#111827] flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                  Stop {vehiclePos.activeIdx + 1}: {activeWaypoint.name}
                </p>
                <span className="font-mono text-[11px] font-semibold text-[#1D4ED8] tabular-nums">
                  {activeWaypoint.etaMinutesFromStart === 0
                    ? 'Departure Point'
                    : `+${activeWaypoint.etaMinutesFromStart} min · ${activeWaypoint.distanceFromPrevKm} km leg`}
                </span>
              </div>
              <p className="text-slate-600">{activeWaypoint.note}</p>
              <p className="text-[11px] font-medium text-slate-700">
                Safety note: {activeWaypoint.safetyTip}
              </p>
            </div>
          )}
        </div>

        {/* Waypoint Timeline List (5 cols) */}
        <div className="lg:col-span-5 p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#111827]">
              Key Route Stops ({projected.length})
            </h3>
            <span className="text-[11px] text-slate-500">Tap any stop to preview</span>
          </div>

          <div className="divide-y divide-slate-100">
            {projected.map((wp, idx) => {
              const isCurrent = vehiclePos.activeIdx === idx;
              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => handleSelectStop(idx)}
                  className={`w-full min-h-[56px] flex items-start gap-3 py-3 px-2.5 text-left rounded-xl transition-colors ${
                    isCurrent ? 'bg-[#EFF6FF]/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                      wp.stopRole === 'pickup'
                        ? 'bg-[#15803D] text-white'
                        : isCurrent
                        ? 'bg-[#1D4ED8] text-white'
                        : 'bg-slate-200 text-[#111827]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#111827] truncate">{wp.name}</p>
                      <span className="font-mono text-[11px] text-slate-600 tabular-nums shrink-0">
                        {wp.etaMinutesFromStart === 0 ? '0 min' : `+${wp.etaMinutesFromStart}m`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{wp.note}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
