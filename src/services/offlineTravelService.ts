import { CAPE_TOWN_DESTINATION_INFO } from '@/src/data/demoData';
import type {
  AccessibilityRoute,
  BookingItem,
  CapeTownWeather,
  DemoUser,
  DestinationAnnouncement,
  OfflineTravelBundle,
  SafetyAdvisory,
  TransportRoute,
  TripActivity,
} from '@/src/types/app';

const OFFLINE_BUNDLE_KEY = 'capesafe_offline_travel_bundle_v1';

export const offlineTravelService = {
  saveBundle(params: {
    user: DemoUser;
    bookings: BookingItem[];
    activities: TripActivity[];
    transportRoutes: TransportRoute[];
    accessibilityRoutes: AccessibilityRoute[];
    advisories: SafetyAdvisory[];
    announcements: DestinationAnnouncement[];
    weather: CapeTownWeather;
  }): OfflineTravelBundle {
    const now = new Date();
    const bundle: OfflineTravelBundle = {
      savedAtIso: now.toISOString(),
      savedAtLabel: now.toLocaleString('en-ZA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      userSummary: {
        name: params.user.name,
        location: params.user.location,
        passId: params.user.passId || 'CS360-884210',
        emergencyContact: params.user.emergencyContact || '112 / 107',
        preferredLanguage: params.user.preferredLanguage || 'English',
      },
      confirmedBookings: params.bookings.filter((b) => b.status === 'Confirmed'),
      tripActivities: params.activities,
      transportRoutes: params.transportRoutes,
      accessibilityRoutes: params.accessibilityRoutes,
      advisoriesSnapshot: params.advisories,
      announcementsSnapshot: params.announcements.filter((a) => a.active),
      weatherSnapshot: params.weather,
      destinationInfo: CAPE_TOWN_DESTINATION_INFO,
    };

    try {
      localStorage.setItem(OFFLINE_BUNDLE_KEY, JSON.stringify(bundle));
    } catch {
      // Ignore storage quota errors
    }

    return bundle;
  },

  loadBundle(): OfflineTravelBundle | null {
    try {
      const raw = localStorage.getItem(OFFLINE_BUNDLE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OfflineTravelBundle;
    } catch {
      return null;
    }
  },

  clearBundle(): void {
    try {
      localStorage.removeItem(OFFLINE_BUNDLE_KEY);
    } catch {
      // Ignore
    }
  },
};
