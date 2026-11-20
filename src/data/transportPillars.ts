import { resolveZoneCoordinates } from '@/src/components/map/CapeTownMap';
import type { DurationUnit, PricingModel } from '@/src/types/app';
import { calculateBookingEndDateTime } from '@/src/utils/bookingCalculations';

export type TransportDurationOption = 'hourly' | 'half_day' | 'full_day' | 'night_session';

export interface VisitorPickupPoint {
  id: string;
  label: string;
  precinct: string;
  bayDetail: string;
  lat: number;
  lng: number;
}

export interface RouteWaypoint {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  etaMinutesFromStart: number;
  distanceFromPrevKm: number;
  stopRole: 'pickup' | 'waypoint' | 'destination';
  note: string;
  safetyTip: string;
}

export type VehicleTierId = 'city-sedan' | 'comfort-suv' | 'group-mpv';

export interface VisitorVehicleTier {
  id: VehicleTierId;
  name: string;
  tagline: string;
  description: string;
  maxPassengers: number;
  luggageSummary: string;
  highlights: string[];
  rateMultiplier: number;
  imageUrl: string;
  accessibleFriendly: boolean;
  gpsMonitored: boolean;
}

export interface VisitorTravelPillar {
  id: string;
  pillarTag: string;
  title: string;
  destinationZone: string;
  summary: string;
  imageUrl: string;
  providerId: string;
  providerName: string;
  driverName: string;
  vehicleLabel: string;
  pdpBadge: string;
  accessible: boolean;
  safetyVerified: boolean;
  hourlyRateZar: number;
  halfDayRateZar: number;
  fullDayRateZar: number;
  nightSessionRateZar: number;
  localGuidanceNote: string;
  defaultWaypoints: Array<Omit<RouteWaypoint, 'etaMinutesFromStart' | 'distanceFromPrevKm'>>;
}

export const VISITOR_VEHICLE_TIERS: VisitorVehicleTier[] = [
  {
    id: 'city-sedan',
    name: 'City Sedan',
    tagline: 'Airport, Waterfront & CBD Everyday Transfers',
    description:
      'Comfortable air-conditioned hybrid sedan with a vetted PrDP driver, live GPS monitoring, and flexible hourly, half-day, full-day, or evening safe-return charters.',
    maxPassengers: 3,
    luggageSummary: '2 large bags · 2 cabin bags',
    highlights: ['GPS Monitored', 'Vetted PrDP Driver', 'USB-C & A/C'],
    rateMultiplier: 1,
    imageUrl: '/src/assets/images/vehicle_city_sedan_1795166350314.jpg',
    accessibleFriendly: false,
    gpsMonitored: true,
  },
  {
    id: 'comfort-suv',
    name: 'Comfort SUV',
    tagline: 'Coastal Scenic Drives & Winelands Touring',
    description:
      'Extra legroom and higher seating visibility for Chapman’s Peak, Table Mountain slopes, and Stellenbosch or Franschhoek safe-driver tasting days.',
    maxPassengers: 4,
    luggageSummary: '4 suitcases · daypacks & camera gear',
    highlights: ['GPS Monitored', 'Vetted PrDP Driver', 'Extra Boot Space'],
    rateMultiplier: 1.25,
    imageUrl: '/src/assets/images/vehicle_comfort_suv_1795166350522.jpg',
    accessibleFriendly: true,
    gpsMonitored: true,
  },
  {
    id: 'group-mpv',
    name: 'Group MPV',
    tagline: 'Families, Strollers & Small-Group Charters',
    description:
      'Wide sliding-door 7-seater cabin ideal for families, airport arrivals with full luggage, or friends sharing a full-day peninsula or night charter.',
    maxPassengers: 7,
    luggageSummary: '6 suitcases · foldable stroller ready',
    highlights: ['GPS Monitored', 'Sliding Step-Free Door', 'Vetted PrDP Driver'],
    rateMultiplier: 1.5,
    imageUrl: '/src/assets/images/vehicle_group_mpv_1795166350241.jpg',
    accessibleFriendly: true,
    gpsMonitored: true,
  },
];

export function inferVehicleTierFromText(text?: string): VisitorVehicleTier {
  const lower = (text || '').toLowerCase();
  if (lower.includes('mpv') || lower.includes('sprinter') || lower.includes('van') || lower.includes('shuttle') || lower.includes('7-seater') || lower.includes('group')) {
    return VISITOR_VEHICLE_TIERS[2];
  }
  if (lower.includes('suv') || lower.includes('peninsula') || lower.includes('wineland') || lower.includes('chapman')) {
    return VISITOR_VEHICLE_TIERS[1];
  }
  return VISITOR_VEHICLE_TIERS[0];
}

export const VISITOR_PICKUP_POINTS: VisitorPickupPoint[] = [
  {
    id: 'pu-waterfront',
    label: 'V&A Waterfront · Silo & Breakwater Bay',
    precinct: 'V&A Waterfront',
    bayDetail: 'Designated security-patrolled tourist pickup lane outside Zeitz MOCAA Silo Plaza.',
    lat: -33.9036,
    lng: 18.4205,
  },
  {
    id: 'pu-city-bowl',
    label: 'Cape Town CBD · Civic Centre / Long St',
    precinct: 'City Bowl',
    bayDetail: 'Lit central pickup bay adjacent to Civic Centre MyCiTi hub and Adderley Street.',
    lat: -33.9249,
    lng: 18.4241,
  },
  {
    id: 'pu-sea-point',
    label: 'Sea Point Promenade · Pavilion Bay',
    precinct: 'Sea Point',
    bayDetail: 'Beach Road well-lit coastal drop-off bay opposite Sea Point Pavilion.',
    lat: -33.9168,
    lng: 18.3879,
  },
  {
    id: 'pu-camps-bay',
    label: 'Camps Bay · Victoria Rd Beachfront',
    precinct: 'Camps Bay',
    bayDetail: 'Victoria Road tourist bay near Tidal Pool & lifeguard precinct.',
    lat: -33.9508,
    lng: 18.3777,
  },
  {
    id: 'pu-kirstenbosch',
    label: 'Newlands · Kirstenbosch Gate 1',
    precinct: 'Kirstenbosch & Newlands',
    bayDetail: 'SANBI Gate 1 visitor coach & verified charter pickup shelter.',
    lat: -33.9875,
    lng: 18.4327,
  },
  {
    id: 'pu-airport',
    label: 'Cape Town International Airport (CPT)',
    precinct: 'Cape Town International Airport',
    bayDetail: 'Central Arrivals Tour Operator & E-Hailing Pick-Up Zone (Parkade P1 Ground).',
    lat: -33.9715,
    lng: 18.6021,
  },
];

export const VISITOR_TRAVEL_PILLARS: VisitorTravelPillar[] = [
  {
    id: 'pillar-table-mountain',
    pillarTag: 'Table Mountain',
    title: 'Table Mountain & Kloof Nek Summit Charter',
    destinationZone: 'Table Mountain National Park',
    summary:
      'Direct Kloof Nek & Lower Tafelberg Road ascent transfer with sunset Signal Hill overlook option and wind-window flexibility.',
    imageUrl: '/src/assets/images/table_mountain_cableway_1794827755977.jpg',
    providerId: 'demo-provider-1',
    providerName: 'Peninsula Eco Charters & Walks',
    driverName: 'Siyabonga Mokoena',
    vehicleLabel: 'Mercedes eSprinter Zero-Emission · CA 482-910',
    pdpBadge: 'PrDP Verified · SANParks Permitted',
    accessible: true,
    safetyVerified: true,
    hourlyRateZar: 320,
    halfDayRateZar: 1150,
    fullDayRateZar: 1950,
    nightSessionRateZar: 890,
    localGuidanceNote:
      'Cableway afternoon southeaster gusts often rise after 14:30 SAST. Carry a warm windproof jacket even on sunny mornings.',
    defaultWaypoints: [
      {
        id: 'tm-kloof',
        name: 'Kloof Nek Ranger Gate & Park-and-Ride',
        zone: 'Kloof Nek',
        lat: -33.9399,
        lng: 18.4079,
        stopRole: 'waypoint',
        note: 'Quick check of mountain wind board and Table Mountain shuttle lane clearance.',
        safetyTip: 'Stay on paved pedestrian crossings along Tafelberg Road curves.',
      },
      {
        id: 'tm-cableway',
        name: 'Lower Table Mountain Aerial Cableway',
        zone: 'Table Mountain',
        lat: -33.9482,
        lng: 18.4032,
        stopRole: 'waypoint',
        note: 'Level-entry drop-off bay 40m from Upper Ticket Concourse and accessible restrooms.',
        safetyTip: 'Confirm return pickup window before boarding summit cabins.',
      },
      {
        id: 'tm-signal',
        name: 'Signal Hill Panoramic Overlook',
        zone: 'Signal Hill',
        lat: -33.9175,
        lng: 18.4028,
        stopRole: 'destination',
        note: 'Golden-hour harbour & Twelve Apostles overlook with driver standby.',
        safetyTip: 'Do not walk ridge trails after dusk; return directly with your vetted driver.',
      },
    ],
  },
  {
    id: 'pillar-cape-point',
    pillarTag: 'Cape Point',
    title: "Cape Point & Chapman's Peak Peninsula Charter",
    destinationZone: "Cape Point · Simon's Town",
    summary:
      "Full Atlantic & False Bay coastal loop across Chapman's Peak Drive, Boulders Beach Penguin Sanctuary, and Cape of Good Hope.",
    imageUrl: '/src/assets/images/cape_point_peninsula_1794827756125.jpg',
    providerId: 'demo-provider-1',
    providerName: 'Peninsula Eco Charters & Walks',
    driverName: 'Tariq Abrahams',
    vehicleLabel: 'Electric Peninsula Tour Van · CA 719-304',
    pdpBadge: 'PrDP Verified · SANParks Wild Card Lane',
    accessible: true,
    safetyVerified: true,
    hourlyRateZar: 390,
    halfDayRateZar: 1450,
    fullDayRateZar: 2480,
    nightSessionRateZar: 1050,
    localGuidanceNote:
      "Chapman's Peak cliffside drive occasionally closes in 60+ km/h gusts — drivers automatically reroute safely via Ou Kaapse Weg if needed.",
    defaultWaypoints: [
      {
        id: 'cp-chappies',
        name: "Chapman's Peak Marine Drive Overlook",
        zone: "Chapman's Peak Drive",
        lat: -34.087,
        lng: 18.36,
        stopRole: 'waypoint',
        note: 'Scenic coastal bay pull-in above Hout Bay and Noordhoek Beach.',
        safetyTip: 'Keep inside stone parapet barriers; afternoon Atlantic gusts can be sudden.',
      },
      {
        id: 'cp-cape-point',
        name: 'Cape Point & Flying Dutchman Funicular',
        zone: 'Cape Point',
        lat: -34.3568,
        lng: 18.4974,
        stopRole: 'waypoint',
        note: 'Access to Two Oceans lighthouse overlook and step-free funicular platform.',
        safetyTip: 'Keep food packed inside backpacks around baboon conservation areas.',
      },
      {
        id: 'cp-boulders',
        name: "Boulders Beach Penguin Sanctuary (Simon's Town)",
        zone: "Simon's Town",
        lat: -34.1975,
        lng: 18.4513,
        stopRole: 'destination',
        note: 'Step-free timber boardwalk along sheltered False Bay granite coves.',
        safetyTip: 'Allow +30 min M3/Main Rd coastal traffic buffer on return leg.',
      },
    ],
  },
  {
    id: 'pillar-winelands',
    pillarTag: 'Winelands',
    title: 'Stellenbosch & Franschhoek Winelands Safe-Driver Charter',
    destinationZone: 'Stellenbosch & Franschhoek Winelands',
    summary:
      'Dedicated alcohol-free safe driver waiting between historic Stellenbosch estates, Helshoogte Pass, and Franschhoek Valley.',
    imageUrl: '/src/assets/images/explore_kirstenbosch_canopy_1794749103899.jpg',
    providerId: 'demo-provider-1',
    providerName: 'Peninsula Eco Charters & Walks',
    driverName: 'Pieter Vermeulen',
    vehicleLabel: 'Hybrid Touring 7-Seater · CA 604-882',
    pdpBadge: 'PrDP Verified · Western Cape Charter Permit',
    accessible: true,
    safetyVerified: true,
    hourlyRateZar: 440,
    halfDayRateZar: 1620,
    fullDayRateZar: 2850,
    nightSessionRateZar: 1280,
    localGuidanceNote:
      'Zero drink-driving worry: your vetted driver remains on standby outside estate tasting rooms and drives you back safely on the N1/N2 after dusk.',
    defaultWaypoints: [
      {
        id: 'wl-n2',
        name: 'Stellenbosch Winelands Gateway (R310)',
        zone: 'Stellenbosch Gateway',
        lat: -33.946,
        lng: 18.775,
        stopRole: 'waypoint',
        note: 'First estate corridor stop with cellar & farmstall courtyard access.',
        safetyTip: 'Pre-share your expected return time if staying past 18:30 SAST.',
      },
      {
        id: 'wl-dorp',
        name: 'Stellenbosch Historic Dorp Street',
        zone: 'Stellenbosch',
        lat: -33.9378,
        lng: 18.8594,
        stopRole: 'waypoint',
        note: 'Oak-lined architectural walk, art galleries, and café drop-off.',
        safetyTip: 'Driver remains parked at designated tourism coach bay for on-demand pickup.',
      },
      {
        id: 'wl-franschhoek',
        name: 'Franschhoek Village & Helshoogte Overlook',
        zone: 'Franschhoek',
        lat: -33.9114,
        lng: 19.1202,
        stopRole: 'destination',
        note: 'Direct safe-driver wait outside estate restaurants or Huguenot Memorial.',
        safetyTip: 'N1 highway return passes mist zones in winter evenings; seatbelts mandatory.',
      },
    ],
  },
  {
    id: 'pillar-langa',
    pillarTag: 'Langa Heritage',
    title: 'Langa Heritage & Art Walk Safe Transfer',
    destinationZone: 'Langa Precinct',
    summary:
      'Door-to-door accredited transfer linking city hotels with vetted Langa cultural storytellers, ceramic studios, and jazz supper rooms.',
    imageUrl: '/src/assets/images/zeitz_art_heritage_1794827758368.jpg',
    providerId: 'demo-provider-1',
    providerName: 'Peninsula Eco Charters & Walks',
    driverName: 'Bongani Ngcobo',
    vehicleLabel: 'Accredited Community Shuttle · CA 331-512',
    pdpBadge: 'PrDP Verified · Community Tourism Compact',
    accessible: true,
    safetyVerified: true,
    hourlyRateZar: 260,
    halfDayRateZar: 940,
    fullDayRateZar: 1650,
    nightSessionRateZar: 780,
    localGuidanceNote:
      'Includes verified warm handoff to your certified CATHSSETA community guide at Guga S’Thebe and standby return transfer.',
    defaultWaypoints: [
      {
        id: 'lg-woodstock',
        name: 'Woodstock Artisan Hub Junction (Albert Rd)',
        zone: 'Woodstock',
        lat: -33.9273,
        lng: 18.4573,
        stopRole: 'waypoint',
        note: 'Quick N2 feeder link past Old Biscuit Mill & design studios.',
        safetyTip: 'Allow +15 min N2 outbound traffic during morning peak.',
      },
      {
        id: 'lg-museum',
        name: 'Langa Old Pass Office Heritage Museum',
        zone: 'Langa',
        lat: -33.9412,
        lng: 18.521,
        stopRole: 'waypoint',
        note: 'Historical landmark arrival and certified local guide briefing.',
        safetyTip: 'Keep valuables zipped inside daypacks during walking segments.',
      },
      {
        id: 'lg-guga',
        name: "Guga S'Thebe Arts & Cultural Centre",
        zone: 'Langa',
        lat: -33.9445,
        lng: 18.5268,
        stopRole: 'destination',
        note: 'Pottery studio, youth theatre, and doorstep pickup bay for safe return.',
        safetyTip: 'Confirm pickup handoff code (PK-XXXX) with your waiting driver.',
      },
    ],
  },
  {
    id: 'pillar-waterfront',
    pillarTag: 'Waterfront & Coast',
    title: 'Atlantic Seaboard, Waterfront & Evening Dining Hopper',
    destinationZone: 'V&A Waterfront — Camps Bay',
    summary:
      'Flexible point-to-point coastal charter covering V&A Waterfront, Sea Point Promenade, Clifton overlooks, and Camps Bay dining bays.',
    imageUrl: '/src/assets/images/waterfront_harbour_cruise_1794827757144.jpg',
    providerId: 'demo-provider-1',
    providerName: 'Peninsula Eco Charters & Walks',
    driverName: 'Amina Hendricks',
    vehicleLabel: 'Wheelchair-Lift Electric MPV · CA 205-774',
    pdpBadge: 'PrDP Verified · Step-Free Accredited',
    accessible: true,
    safetyVerified: true,
    hourlyRateZar: 280,
    halfDayRateZar: 980,
    fullDayRateZar: 1720,
    nightSessionRateZar: 790,
    localGuidanceNote:
      'Ideal for evening oceanfront dining: driver picks you up directly inside lit Waterfront or Camps Bay security bays.',
    defaultWaypoints: [
      {
        id: 'wf-seapoint',
        name: 'Sea Point Promenade Coastal Mile',
        zone: 'Sea Point',
        lat: -33.9168,
        lng: 18.3879,
        stopRole: 'waypoint',
        note: 'Flat oceanfront walkway with sunset lighting and ambassador patrols.',
        safetyTip: 'Use illuminated promenade bays for evening boarding.',
      },
      {
        id: 'wf-clifton',
        name: 'Clifton Fourth Scenic Steps Overlook',
        zone: 'Clifton',
        lat: -33.9408,
        lng: 18.3772,
        stopRole: 'waypoint',
        note: 'Victoria Road scenic granite cove photo turnout.',
        safetyTip: 'Narrow coastal road; board curbside facing away from traffic.',
      },
      {
        id: 'wf-campsbay',
        name: 'Camps Bay Palm Strip & Tidal Pool',
        zone: 'Camps Bay',
        lat: -33.9508,
        lng: 18.3777,
        stopRole: 'destination',
        note: 'Direct lit beachfront drop-off in front of Atlantic terraces.',
        safetyTip: 'Keep pickup code ready for swift late-evening departure.',
      },
    ],
  },
];

export interface TransportQuoteCalculation {
  durationOption: TransportDurationOption;
  durationUnit: DurationUnit;
  durationValue: number;
  durationLabel: string;
  pricingModel: PricingModel;
  unitPriceZar: number;
  totalZar: number;
  endDate: string;
  endTime: string;
  endLabel: string;
  hoursCovered: number;
}

export function calculateVisitorTransportQuote(params: {
  pillar: VisitorTravelPillar;
  startDate: string;
  startTime: string;
  durationOption: TransportDurationOption;
  hourlyCount: number;
  vehicleTier?: VisitorVehicleTier;
}): TransportQuoteCalculation {
  const { pillar, startDate, startTime, durationOption, hourlyCount, vehicleTier } = params;
  const multiplier = vehicleTier?.rateMultiplier ?? 1;

  const scaledHourlyRate = Math.round(pillar.hourlyRateZar * multiplier);
  const scaledHalfDayRate = Math.round(pillar.halfDayRateZar * multiplier);
  const scaledFullDayRate = Math.round(pillar.fullDayRateZar * multiplier);
  const scaledNightRate = Math.round(pillar.nightSessionRateZar * multiplier);

  if (durationOption === 'hourly') {
    const safeHours = Math.max(1, Math.min(12, Math.round(hourlyCount || 2)));
    const end = calculateBookingEndDateTime(startDate, startTime, 'hours', safeHours);
    return {
      durationOption,
      durationUnit: 'hours',
      durationValue: safeHours,
      durationLabel: `${safeHours} ${safeHours === 1 ? 'Hour' : 'Hours'} Hourly Charter`,
      pricingModel: 'per_unit',
      unitPriceZar: scaledHourlyRate,
      totalZar: Math.round(scaledHourlyRate * safeHours),
      endDate: end.endDate,
      endTime: end.endTime,
      endLabel: end.endLabel,
      hoursCovered: safeHours,
    };
  }

  if (durationOption === 'half_day') {
    const end = calculateBookingEndDateTime(startDate, startTime, 'sessions', 2);
    return {
      durationOption,
      durationUnit: 'sessions',
      durationValue: 2,
      durationLabel: 'Half-Day Charter (4h · 2 Sessions)',
      pricingModel: 'per_unit',
      unitPriceZar: Math.round(scaledHalfDayRate / 2),
      totalZar: scaledHalfDayRate,
      endDate: end.endDate,
      endTime: end.endTime,
      endLabel: end.endLabel,
      hoursCovered: 4,
    };
  }

  if (durationOption === 'full_day') {
    const end = calculateBookingEndDateTime(startDate, startTime, 'hours', 8);
    return {
      durationOption,
      durationUnit: 'hours',
      durationValue: 8,
      durationLabel: 'Full-Day Charter (8h Peninsula Window)',
      pricingModel: 'per_unit',
      unitPriceZar: Math.round(scaledFullDayRate / 8),
      totalZar: scaledFullDayRate,
      endDate: end.endDate,
      endTime: end.endTime,
      endLabel: end.endLabel,
      hoursCovered: 8,
    };
  }

  // 'night_session': 2-hour evening/night safe return
  const end = calculateBookingEndDateTime(startDate, startTime, 'sessions', 1);
  return {
    durationOption,
    durationUnit: 'sessions',
    durationValue: 1,
    durationLabel: 'Night / Evening Session (2h Door-to-Door)',
    pricingModel: 'per_unit',
    unitPriceZar: scaledNightRate,
    totalZar: scaledNightRate,
    endDate: end.endDate,
    endTime: end.endTime,
    endLabel: end.endLabel,
    hoursCovered: 2,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildRouteWaypointsForTrip(
  pickup: VisitorPickupPoint,
  pillar: VisitorTravelPillar
): {
  waypoints: RouteWaypoint[];
  totalDistanceKm: number;
  totalDriveMinutes: number;
  googleMapsUrl: string;
} {
  const waypoints: RouteWaypoint[] = [
    {
      id: pickup.id,
      name: pickup.label,
      zone: pickup.precinct,
      lat: pickup.lat,
      lng: pickup.lng,
      etaMinutesFromStart: 0,
      distanceFromPrevKm: 0,
      stopRole: 'pickup',
      note: pickup.bayDetail,
      safetyTip: 'Confirm your PK-XXXX handoff code before stepping into the vehicle.',
    },
  ];

  let prevLat = pickup.lat;
  let prevLng = pickup.lng;
  let cumulativeKm = 0;
  let cumulativeMins = 0;

  pillar.defaultWaypoints.forEach((wp) => {
    const rawKm = haversineKm(prevLat, prevLng, wp.lat, wp.lng);
    const roadKm = Math.max(1.2, Math.round(rawKm * 1.28 * 10) / 10);
    const legMins = Math.max(5, Math.round(roadKm * 1.65 + 4));
    cumulativeKm = Math.round((cumulativeKm + roadKm) * 10) / 10;
    cumulativeMins += legMins;

    waypoints.push({
      ...wp,
      distanceFromPrevKm: roadKm,
      etaMinutesFromStart: cumulativeMins,
    });

    prevLat = wp.lat;
    prevLng = wp.lng;
  });

  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const midStops = waypoints
    .slice(1, -1)
    .map((w) => `${w.lat},${w.lng}`)
    .join('|');
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}${
    midStops ? `&waypoints=${encodeURIComponent(midStops)}` : ''
  }&travelmode=driving`;

  return {
    waypoints,
    totalDistanceKm: cumulativeKm,
    totalDriveMinutes: cumulativeMins,
    googleMapsUrl,
  };
}

export function buildRouteWaypointsFromZoneText(
  routeTitle: string,
  zoneText: string
): {
  waypoints: RouteWaypoint[];
  totalDistanceKm: number;
  totalDriveMinutes: number;
  googleMapsUrl: string;
} {
  const lower = `${routeTitle} ${zoneText}`.toLowerCase();
  const matchedPillar =
    VISITOR_TRAVEL_PILLARS.find(
      (p) =>
        lower.includes(p.pillarTag.toLowerCase()) ||
        (lower.includes('wineland') && p.id === 'pillar-winelands') ||
        (lower.includes('stellenbosch') && p.id === 'pillar-winelands') ||
        (lower.includes('franschhoek') && p.id === 'pillar-winelands') ||
        (lower.includes('cape point') && p.id === 'pillar-cape-point') ||
        (lower.includes('peninsula') && p.id === 'pillar-cape-point') ||
        (lower.includes('langa') && p.id === 'pillar-langa') ||
        (lower.includes('table mountain') && p.id === 'pillar-table-mountain')
    ) || null;

  if (matchedPillar) {
    return buildRouteWaypointsForTrip(VISITOR_PICKUP_POINTS[0], matchedPillar);
  }

  const dest = resolveZoneCoordinates(zoneText || 'Cape Point');
  const pickup = VISITOR_PICKUP_POINTS[0];
  const rawKm = haversineKm(pickup.lat, pickup.lng, dest.lat, dest.lng);
  const roadKm = Math.max(2.5, Math.round(rawKm * 1.28 * 10) / 10);
  const totalMins = Math.max(12, Math.round(roadKm * 1.7 + 5));

  const waypoints: RouteWaypoint[] = [
    {
      id: 'dyn-start',
      name: pickup.label,
      zone: pickup.precinct,
      lat: pickup.lat,
      lng: pickup.lng,
      etaMinutesFromStart: 0,
      distanceFromPrevKm: 0,
      stopRole: 'pickup',
      note: pickup.bayDetail,
      safetyTip: 'Verify pickup code PK-XXXX with your driver.',
    },
    {
      id: 'dyn-dest',
      name: routeTitle,
      zone: zoneText || 'Cape Town',
      lat: dest.lat,
      lng: dest.lng,
      etaMinutesFromStart: totalMins,
      distanceFromPrevKm: roadKm,
      stopRole: 'destination',
      note: dest.transit || 'Scheduled CapeSafe corridor arrival bay.',
      safetyTip: 'Confirm return pickup window before leaving your vehicle.',
    },
  ];

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;

  return {
    waypoints,
    totalDistanceKm: roadKm,
    totalDriveMinutes: totalMins,
    googleMapsUrl,
  };
}
