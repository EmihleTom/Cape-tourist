import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { Compass, Layers, MapPin, ShieldAlert, Store } from 'lucide-react';
import type { AttractionItem, ProviderApplication, SafetyAdvisory } from '@/src/types/app';

export interface MapMarkerItem {
  id: string;
  kind: 'attraction' | 'business' | 'incident' | 'user';
  title: string;
  subtitle: string;
  detail: string;
  badge: string;
  lat: number;
  lng: number;
  dataOrigin: 'demo' | 'live';
}

interface CapeTownMapProps {
  attractions?: AttractionItem[];
  businesses?: ProviderApplication[];
  incidents?: SafetyAdvisory[];
  userLocation?: { lat: number; lng: number; label?: string } | null;
  selectedId?: string | null;
  onSelectMarker?: (marker: MapMarkerItem) => void;
  heightClassName?: string;
  defaultLayers?: {
    attractions?: boolean;
    businesses?: boolean;
    incidents?: boolean;
  };
}

const CAPE_TOWN_CENTER = { lat: -33.965, lng: 18.4241 };

const ZONE_COORDINATES: Array<{ match: string; lat: number; lng: number }> = [
  { match: 'waterfront', lat: -33.9036, lng: 18.4205 },
  { match: 'sea point', lat: -33.9168, lng: 18.3879 },
  { match: 'boulders', lat: -34.1975, lng: 18.4513 },
  { match: "simon's town", lat: -34.1915, lng: 18.4335 },
  { match: 'kirstenbosch', lat: -33.9875, lng: 18.4327 },
  { match: 'newlands', lat: -33.982, lng: 18.445 },
  { match: 'bo-kaap', lat: -33.9209, lng: 18.4148 },
  { match: 'signal hill', lat: -33.9175, lng: 18.4028 },
  { match: 'lion', lat: -33.9351, lng: 18.3891 },
  { match: 'table mountain', lat: -33.9573, lng: 18.4031 },
  { match: 'platteklip', lat: -33.9598, lng: 18.4094 },
  { match: 'chapman', lat: -34.087, lng: 18.36 },
  { match: 'hout bay', lat: -34.0485, lng: 18.3471 },
  { match: 'muizenberg', lat: -34.1088, lng: 18.4706 },
  { match: 'fish hoek', lat: -34.1369, lng: 18.4321 },
  { match: 'langa', lat: -33.9438, lng: 18.5262 },
  { match: 'city bowl', lat: -33.9249, lng: 18.4241 },
  { match: 'camps bay', lat: -33.9508, lng: 18.3777 },
];

export function resolveZoneCoordinates(zone: string): { lat: number; lng: number } {
  const lower = zone.toLowerCase();
  const matched = ZONE_COORDINATES.find((entry) => lower.includes(entry.match));
  return matched ? { lat: matched.lat, lng: matched.lng } : CAPE_TOWN_CENTER;
}

function getMapsApiKey(): string {
  const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return metaEnv?.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
}

const CameraController: React.FC<{ target: MapMarkerItem | null }> = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
  }, [map, target]);
  return null;
};

export const CapeTownMap: React.FC<CapeTownMapProps> = ({
  attractions = [],
  businesses = [],
  incidents = [],
  userLocation = null,
  selectedId = null,
  onSelectMarker,
  heightClassName = 'h-[430px]',
  defaultLayers = { attractions: true, businesses: true, incidents: true },
}) => {
  const apiKey = getMapsApiKey();
  const [showAttractions, setShowAttractions] = useState(defaultLayers.attractions ?? true);
  const [showBusinesses, setShowBusinesses] = useState(defaultLayers.businesses ?? true);
  const [showIncidents, setShowIncidents] = useState(defaultLayers.incidents ?? true);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (selectedId) {
      setActiveMarkerId(selectedId);
    }
  }, [selectedId]);

  const markers: MapMarkerItem[] = [];

  if (showAttractions) {
    attractions.forEach((attr) => {
      markers.push({
        id: attr.id,
        kind: 'attraction',
        title: attr.title,
        subtitle: attr.precinct,
        detail: attr.accessibilitySummary,
        badge: attr.safetyStatus,
        lat: attr.lat,
        lng: attr.lng,
        dataOrigin: attr.dataOrigin,
      });
    });
  }

  if (showBusinesses) {
    businesses.forEach((biz) => {
      const coords =
        typeof biz.lat === 'number' && typeof biz.lng === 'number'
          ? { lat: biz.lat, lng: biz.lng }
          : resolveZoneCoordinates(biz.zone);
      markers.push({
        id: biz.id,
        kind: 'business',
        title: biz.businessName,
        subtitle: `${biz.category} · ${biz.zone}`,
        detail: biz.description || biz.complianceDocs,
        badge: biz.status,
        lat: coords.lat,
        lng: coords.lng,
        dataOrigin: biz.dataOrigin,
      });
    });
  }

  if (showIncidents) {
    incidents.forEach((inc) => {
      // Only plot exact coordinates when explicit location consent was granted;
      // otherwise plot at general precinct center for situational awareness.
      const hasConsentedCoords =
        inc.locationConsent === true &&
        typeof inc.sharedLat === 'number' &&
        typeof inc.sharedLng === 'number';
      const coords = hasConsentedCoords
        ? { lat: inc.sharedLat!, lng: inc.sharedLng! }
        : resolveZoneCoordinates(inc.zone);

      markers.push({
        id: inc.id,
        kind: 'incident',
        title: inc.title,
        subtitle: hasConsentedCoords
          ? `${inc.zone} · Consented Pin`
          : `${inc.zone} · General Zone`,
        detail: inc.summary,
        badge: `${inc.severity} · ${inc.status || 'Open'}`,
        lat: coords.lat,
        lng: coords.lng,
        dataOrigin: inc.dataOrigin,
      });
    });
  }

  if (userLocation) {
    markers.push({
      id: 'user-consented-location',
      kind: 'user',
      title: userLocation.label || 'Your Shared GPS Location',
      subtitle: `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`,
      detail: 'Captured in-browser with your explicit consent.',
      badge: 'Live GPS',
      lat: userLocation.lat,
      lng: userLocation.lng,
      dataOrigin: 'live',
    });
  }

  const activeMarker = markers.find((m) => m.id === activeMarkerId) ?? null;

  const handleMarkerClick = (marker: MapMarkerItem) => {
    setActiveMarkerId(marker.id);
    onSelectMarker?.(marker);
  };

  const getPinColors = (kind: MapMarkerItem['kind'], badge: string) => {
    if (kind === 'user') {
      return { background: '#2563EB', borderColor: '#1E3A8A', glyphColor: '#FFFFFF' };
    }
    if (kind === 'incident') {
      if (badge.includes('Elevated')) {
        return { background: '#DC2626', borderColor: '#7F1D1D', glyphColor: '#FFFFFF' };
      }
      if (badge.includes('Advisory')) {
        return { background: '#D97706', borderColor: '#78350F', glyphColor: '#FFFFFF' };
      }
      return { background: '#15803D', borderColor: '#14532D', glyphColor: '#FFFFFF' };
    }
    if (kind === 'business') {
      return { background: '#0B1F3A', borderColor: '#071529', glyphColor: '#5EEAD4' };
    }
    return { background: '#0D9488', borderColor: '#0F766E', glyphColor: '#FFFFFF' };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Layer Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          <span className="text-xs font-bold text-[#0B1F3A]">
            Interactive Cape Peninsula Map
          </span>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            ({markers.length} pins)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {attractions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAttractions((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                showAttractions
                  ? 'border-[#0D9488] bg-[#F0FDFA] text-[#0F766E]'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              Attractions ({attractions.length})
            </button>
          )}
          {businesses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBusinesses((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                showBusinesses
                  ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
              Businesses ({businesses.length})
            </button>
          )}
          {incidents.length > 0 && (
            <button
              type="button"
              onClick={() => setShowIncidents((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                showIncidents
                  ? 'border-amber-700 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Safety &amp; Incidents ({incidents.length})
            </button>
          )}
        </div>
      </div>

      {/* Live Google Map or Graceful Fallback Coordinate Explorer */}
      {apiKey ? (
        <div className={`relative w-full ${heightClassName}`}>
          <APIProvider apiKey={apiKey} language="en" region="ZA">
            <GoogleMap
              style={{ width: '100%', height: '100%' }}
              defaultCenter={CAPE_TOWN_CENTER}
              defaultZoom={11}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              <CameraController target={activeMarker} />

              {markers.map((marker) => {
                const colors = getPinColors(marker.kind, marker.badge);
                const glyph =
                  marker.kind === 'incident'
                    ? '!'
                    : marker.kind === 'business'
                    ? 'B'
                    : marker.kind === 'user'
                    ? 'U'
                    : 'A';

                return (
                  <AdvancedMarker
                    key={marker.id}
                    position={{ lat: marker.lat, lng: marker.lng }}
                    title={marker.title}
                    onClick={() => handleMarkerClick(marker)}
                  >
                    <Pin
                      background={colors.background}
                      borderColor={colors.borderColor}
                      glyphColor={colors.glyphColor}
                      glyphText={glyph}
                    />
                  </AdvancedMarker>
                );
              })}

              {activeMarker && (
                <InfoWindow
                  position={{ lat: activeMarker.lat, lng: activeMarker.lng }}
                  onCloseClick={() => setActiveMarkerId(null)}
                >
                  <div className="max-w-[230px] p-1 text-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                      {activeMarker.kind} · {activeMarker.badge}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[#0B1F3A]">
                      {activeMarker.title}
                    </p>
                    <p className="text-[11px] text-slate-500">{activeMarker.subtitle}</p>
                    <p className="mt-1.5 text-xs text-slate-700 leading-snug">
                      {activeMarker.detail}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </APIProvider>
        </div>
      ) : (
        <div className="bg-slate-50 p-5 space-y-4">
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Interactive Google Maps tiles activate automatically once{' '}
              <code className="font-mono font-semibold">VITE_GOOGLE_MAPS_API_KEY</code> is available in runtime secrets. Showing synchronized Cape Peninsula coordinate pins below.
            </span>
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline whitespace-nowrap"
            >
              Maps Setup Guide
            </a>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {markers.map((marker) => {
              const isSelected = activeMarkerId === marker.id;
              return (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => handleMarkerClick(marker)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-[#0D9488] bg-[#F0FDFA]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold uppercase text-[#0D9488]">{marker.kind}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {marker.lat.toFixed(3)}, {marker.lng.toFixed(3)}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0D9488]" aria-hidden="true" />
                    <span className="truncate">{marker.title}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600 truncate">{marker.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
