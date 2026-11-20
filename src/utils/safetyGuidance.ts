import type { CapeTownWeather } from '@/src/types/app';
import { resolveZoneCoordinates } from '@/src/components/map/CapeTownMap';

export interface EmergencyContactItem {
  id: string;
  service: string;
  number: string;
  telHref: string;
  scope: string;
  availability: string;
  priority: 'primary' | 'rescue' | 'support';
}

export const EMERGENCY_CONTACTS: EmergencyContactItem[] = [
  {
    id: 'emg-saps-10111',
    service: 'SAPS Police Flying Squad',
    number: '10111',
    telHref: 'tel:10111',
    scope: 'Urgent crime, threat, or police dispatch anywhere in South Africa',
    availability: '24/7 National Toll-Free',
    priority: 'primary',
  },
  {
    id: 'emg-cpt-107',
    service: 'City of Cape Town Emergency',
    number: '107',
    telHref: 'tel:107',
    scope: 'Unified fire, traffic, municipal rescue & metro dispatch (021 480 7700 from mobile)',
    availability: '24/7 Metro Dispatch',
    priority: 'primary',
  },
  {
    id: 'emg-mobile-112',
    service: 'Mobile Network Emergency',
    number: '112',
    telHref: 'tel:112',
    scope: 'Free cellular emergency routing even with low signal or locked SIM',
    availability: '24/7 All SA Networks',
    priority: 'primary',
  },
  {
    id: 'emg-wsar',
    service: 'Wilderness Search & Rescue (WSAR)',
    number: '021 937 0300',
    telHref: 'tel:+27219370300',
    scope: 'Table Mountain, Lion’s Head, Silvermine & Western Cape hiking trails',
    availability: '24/7 Mountain Rescue',
    priority: 'rescue',
  },
  {
    id: 'emg-nsri',
    service: 'NSRI Sea Rescue',
    number: '087 094 9774',
    telHref: 'tel:+27870949774',
    scope: 'Coastal incidents, kayaking, harbour vessels & False Bay / Atlantic waters',
    availability: '24/7 Maritime Rescue',
    priority: 'rescue',
  },
  {
    id: 'emg-ems-10177',
    service: 'Western Cape EMS / Ambulance',
    number: '10177',
    telHref: 'tel:10177',
    scope: 'Emergency medical response, trauma & ambulance dispatch',
    availability: '24/7 Medical Emergency',
    priority: 'rescue',
  },
  {
    id: 'emg-visitor-support',
    service: 'Cape Town Tourism Visitor Support',
    number: '086 111 4911',
    telHref: 'tel:+27861114911',
    scope: 'Lost passport assistance, consulate liaison & visitor victim support',
    availability: 'Daily Support Desk',
    priority: 'support',
  },
];

export type TimeGuidanceBand = 'Daylight' | 'Dusk / Sunset' | 'After Dark';

export interface SmartGuidanceResult {
  timeBand: TimeGuidanceBand;
  timingTip: string;
  weatherCaveat: string;
  bufferMinutes: number;
  bufferNote: string;
  tone: 'nominal' | 'advisory' | 'alert';
}

function parseMinutesFromTimeString(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export function computeSmartGuidance(params: {
  title?: string;
  zone?: string;
  category?: string;
  timeSlot?: string;
  endTime?: string;
  durationUnit?: 'hours' | 'days' | 'nights' | 'sessions';
  durationValue?: number;
  weather?: CapeTownWeather;
}): SmartGuidanceResult {
  const { title = '', zone = '', category = '', timeSlot, endTime, durationUnit, durationValue = 1, weather } = params;
  const titleAndCat = `${title} ${category}`.toLowerCase();
  const contextText = `${title} ${zone} ${category}`.toLowerCase();

  // Priority-ordered venue classifiers so gardens, museums, beaches & harbours do not receive kayak boilerplate
  const isMarineCraft =
    /kayak|catamaran|pirate boat|eco-cruise|harbour.*cruise|robben island|ferry|surfing lesson|surf lesson/i.test(
      titleAndCat
    );
  const isPeakOrDrive =
    /table mountain|cableway|lion's head|lions head|signal hill|platteklip|chapman's peak|chapmans peak|cape point|cape of good hope|contour.*hike|summit|gorge|ridge trail/i.test(
      contextText
    );
  const isIndoorVenue =
    /aquarium|district six|castle of good hope|zeitz|mocaa|cooking class|printmaking|ceramic art|food tasting|biscuit mill|museum.*tour/i.test(
      titleAndCat
    );
  const isGardenOrPark =
    /kirstenbosch|company's garden|green point urban park|picnic|world of birds|wildlife sanctuary/i.test(
      titleAndCat
    );
  const isCycling = /e-bike|cycling/i.test(titleAndCat);
  const isHeritageWalk = /bo-kaap|langa|walking tour|cbd.*walk/i.test(titleAndCat);
  const isHarbourfront = /v&a waterfront|cape wheel|hout bay harbour|mariner's wharf/i.test(
    titleAndCat
  );
  const isBeachOrCoast =
    /beach|boulders|muizenberg|camps bay|clifton|horse riding|wildlife excursion|photography tour/i.test(
      titleAndCat
    );
  const isTransport =
    /shuttle|bus|rail|airport|transfer|charter|transport|e-hailing|uber|sedan|suv|mpv|safe-driver|winelands/i.test(
      contextText
    );

  const isMountainTiming = isPeakOrDrive || /mountain/i.test(category);
  const isCoastalTiming = isMarineCraft || isBeachOrCoast || isHarbourfront;

  const startMins = parseMinutesFromTimeString(timeSlot) ?? 9 * 60;
  let effectiveEndMins = parseMinutesFromTimeString(endTime);
  if (effectiveEndMins === null) {
    const addedMins =
      durationUnit === 'hours'
        ? durationValue * 60
        : durationUnit === 'sessions'
        ? durationValue * 120
        : 180;
    effectiveEndMins = startMins + addedMins;
  }

  // Cape Town spring/summer twilight boundaries: 06:00 sunrise, ~17:45 late sun, ~19:30 dusk
  const touchesNight = startMins >= 19 * 60 + 30 || startMins < 6 * 60 || effectiveEndMins >= 19 * 60 + 45;
  const touchesDusk = !touchesNight && (startMins >= 17 * 60 + 15 || effectiveEndMins >= 17 * 60 + 30);

  let timeBand: TimeGuidanceBand = 'Daylight';
  let timingTip =
    'Optimal daylight window: keep hydrated, carry sun protection, and stay on marked precinct corridors.';

  if (touchesNight) {
    timeBand = 'After Dark';
    if (isMountainTiming) {
      timingTip =
        'After-dusk mountain caution: avoid unlit ridge or gorge trails after sunset unless with an accredited night-hike guide carrying headlamps and WSAR contact (021 937 0300).';
    } else if (isCoastalTiming) {
      timingTip =
        'After-dark coastal note: stick to lit Waterfront/Sea Point promenades and arrange direct e-hailing pickup from verified bays rather than walking dark beach paths.';
    } else {
      timingTip =
        'After-dusk city note: travel between venues using pre-booked transport or verified pickup bays, and verify your pickup handoff code before boarding.';
    }
  } else if (touchesDusk) {
    timeBand = 'Dusk / Sunset';
    if (isMountainTiming) {
      timingTip =
        'Sunset window note: mountain temperatures drop rapidly after dusk—pack a windproof layer, headlamp, and aim to begin descent 45 min before dark.';
    } else {
      timingTip =
        'Golden-hour transition: plan your return leg before 19:30 or pre-book an accredited pickup from lit precinct bays.';
    }
  } else if (isIndoorVenue) {
    timingTip =
      'Weather-resilient indoor venue: relaxed daylight entry with climate-controlled galleries and verified pickup bays nearby.';
  } else if (isGardenOrPark) {
    timingTip =
      'Daylight garden hours: bring sun protection, water, and enjoy shaded oak/fynbos paths well before closing gates.';
  } else if (isBeachOrCoast) {
    timingTip =
      'Coastal daylight check: review daily tide tables, UV peak (11:00–15:00), and Shark Spotters / lifeguard flag status on arrival.';
  }

  // Venue-tailored weather caveats & buffers
  const windGusts = weather?.windGustsKmh ?? 28;
  const windSpeed = weather?.windSpeedKmh ?? 18;
  const cableRisk = weather?.cablewayRisk ?? 'Low';
  const temp = weather?.temperatureC ?? 21;

  let weatherCaveat = `${temp}°C · ${windSpeed} km/h breeze — clear conditions for scheduled Cape Town itineraries.`;
  let tone: SmartGuidanceResult['tone'] = touchesNight ? 'advisory' : 'nominal';
  let bufferMinutes = 20;
  let bufferNote = 'Arrive 20 min early for check-in, gear briefing & pickup code verification.';

  if (isMarineCraft) {
    if (windGusts >= 32) {
      tone = 'advisory';
      weatherCaveat = `Atlantic gusts (${windGusts} km/h) can increase swell & spray: wear non-slip footwear on jetties and confirm sea-state check-in.`;
    } else {
      weatherCaveat = `Marine forecast (${temp}°C, ${windSpeed} km/h): calm harbour/bay launch, pack a light spray shell & secure phones in dry pouches.`;
    }
    bufferMinutes = 25;
    bufferNote = 'Suggested +25 min buffer for PFD life-jacket/wetsuit fitting, pier boarding & sea-state briefing.';
  } else if (isPeakOrDrive) {
    if (cableRisk !== 'Low' || windGusts >= 35) {
      tone = cableRisk === 'High' || windGusts >= 48 ? 'alert' : 'advisory';
      weatherCaveat = `Peak & cliffside gusts at ${windGusts} km/h (${cableRisk} cableway risk): pack a warm windproof layer and check mist or scenic-road closure notices.`;
    } else {
      weatherCaveat = `Clear mountain & headland visibility (${temp}°C, ${windSpeed} km/h): pack a windshell for summit temperature drops & bright UV reflection.`;
    }
    bufferMinutes = touchesDusk || cableRisk !== 'Low' ? 45 : 35;
    bufferNote = `Suggested +${bufferMinutes} min buffer for ${
      /chapman/i.test(contextText) ? 'cliffside lookout pull-offs & toll gate queues' : 'queue times, thermal layers & safe pre-dusk return'
    }.`;
  } else if (isIndoorVenue) {
    weatherCaveat = `Sheltered indoor / courtyard space (${temp}°C outside): rain and coastal Southeaster winds will not disrupt your visit; bring a light sweater.`;
    bufferMinutes = 15;
    bufferNote = 'Suggested +15 min buffer for timed ticket scan, security bag check & studio orientation.';
  } else if (isGardenOrPark) {
    weatherCaveat = `Mild garden conditions (${temp}°C, ${windSpeed} km/h breeze): wear comfy walking shoes on shaded avenues, sun hat & insect-safe sunscreen.`;
    bufferMinutes = 15;
    bufferNote = 'Suggested +15 min buffer for conservatory/gate parking, shaded lawn setup & electric cart access.';
  } else if (isHarbourfront) {
    weatherCaveat = `Open-quay breeze (${temp}°C, ${windSpeed} km/h): carry a light windbreaker for pier walks or Wheel cabins and stay in patrolled precinct lanes.`;
    bufferMinutes = 20;
    bufferNote = 'Suggested +20 min buffer for Silo/Wharf parking, pedestrian screening & timed attraction boarding.';
  } else if (isBeachOrCoast) {
    if (/wildlife|photography/i.test(titleAndCat)) {
      weatherCaveat = `Peninsula coast check (${temp}°C, ${windSpeed} km/h): shield lenses from sea spray, keep bags zipped around baboons & watch wet granite.`;
      bufferMinutes = 25;
      bufferNote = 'Suggested +25 min buffer for golden-hour light setups & reserve gate entry.';
    } else {
      weatherCaveat = `Shoreline conditions (${temp}°C, ${windSpeed} km/h): cold 11–14°C Atlantic vs mild False Bay surf; swim between flags & watch incoming tides.`;
      bufferMinutes = 20;
      bufferNote = 'Suggested +20 min buffer for coastal parking, sun protection & tide-line awareness.';
    }
  } else if (isCycling) {
    weatherCaveat = `Promenade cycle forecast (${temp}°C, ${windSpeed} km/h coastal breeze): sunglasses, closed trainers & a light windshell make coastal riding ideal.`;
    bufferMinutes = 20;
    bufferNote = 'Suggested +20 min buffer for e-bike frame sizing, helmet fit & cycle-lane briefing.';
  } else if (isHeritageWalk) {
    weatherCaveat = `Urban heritage conditions (${temp}°C, ${windSpeed} km/h): wear supportive flat soles for historic cobblestones and carry drinking water.`;
    bufferMinutes = 15;
    bufferNote = 'Suggested +15 min buffer for square meet-up with your heritage storyteller & headset check.';
  } else if (isTransport) {
    weatherCaveat =
      windGusts >= 38
        ? `Wind gusts (${windGusts} km/h) may slow coastal M6/Chapmans corridors; confirm driver pickup bay ahead of arrival.`
        : `Allow CBD & waterfront peak-hour traffic leeway (07:15–09:00 and 16:00–18:15 SAST).`;
    bufferMinutes = 30;
    bufferNote = 'Suggested +30 min buffer for M3/N2 corridor traffic and driver/ferry gate boarding.';
  }

  return {
    timeBand,
    timingTip,
    weatherCaveat,
    bufferMinutes,
    bufferNote,
    tone,
  };
}

export interface RouteTransferEstimate {
  distanceKm: number;
  estimatedMinutes: number;
  estimatedFareZar: number;
  recommendedMode: string;
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

export function estimateRouteTransfer(fromZone: string, toZone: string): RouteTransferEstimate {
  const fromCoords = resolveZoneCoordinates(fromZone || 'V&A Waterfront');
  const toCoords = resolveZoneCoordinates(toZone || 'V&A Waterfront');
  const rawKm = haversineKm(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
  const roadKm = Math.max(1.2, Math.round(rawKm * 1.32 * 10) / 10);

  if (rawKm < 0.8) {
    return {
      distanceKm: 0.8,
      estimatedMinutes: 10,
      estimatedFareZar: 0,
      recommendedMode: 'Walkable within precinct (10 min)',
    };
  }

  const estimatedMinutes = Math.max(12, Math.round(roadKm * 2.1 + 6));
  const estimatedFareZar = Math.max(25, Math.round((20 + roadKm * 11.5) / 5) * 5);
  const recommendedMode =
    roadKm <= 8
      ? 'MyCiTi Rapid Bus / Verified E-Hailing'
      : 'Accredited Point-to-Point Shuttle / E-Hailing';

  return {
    distanceKm: roadKm,
    estimatedMinutes,
    estimatedFareZar,
    recommendedMode,
  };
}

export function buildTripShareSummary(params: {
  travelerName: string;
  title: string;
  zone: string;
  dateLabel: string;
  timeWindowLabel: string;
  pickupCode?: string;
  providerName?: string;
  providerVerified?: boolean;
  emergencyContact?: string;
  customNote?: string;
}): string {
  const lines = [
    `KaapConnect Live Trip Status — ${params.travelerName}`,
    `Experience / Route: ${params.title}`,
    `Precinct / Corridor: ${params.zone}`,
    `Schedule: ${params.dateLabel} · ${params.timeWindowLabel}`,
  ];
  if (params.providerName) {
    lines.push(
      `Operator: ${params.providerName} (${
        params.providerVerified ? 'Safety Verified / Accredited' : 'Pending Safety Verification'
      })`
    );
  }
  if (params.pickupCode) {
    lines.push(`Booking & Pickup Handoff Code: ${params.pickupCode}`);
  }
  if (params.customNote?.trim()) {
    lines.push(`Traveler Note: ${params.customNote.trim()}`);
  }
  if (params.emergencyContact) {
    lines.push(`ICE Contact: ${params.emergencyContact}`);
  }
  lines.push('Cape Town Emergency Lines: SAPS Police 10111 · City Dispatch 107 · WSAR Mountain 021 937 0300 · NSRI Sea 087 094 9774');
  return lines.join('\n');
}
