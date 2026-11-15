import { useEffect, useState } from 'react';
import { AppShell } from '@/src/components/layout/AppShell';
import { OfflineIndicator } from '@/src/components/pwa/OfflineIndicator';
import { DEMO_USERS } from '@/src/data/demoData';
import { AuthPages } from '@/src/pages/AuthPages';
import { AdminDashboard } from '@/src/pages/dashboards/AdminDashboard';
import { ProviderDashboard } from '@/src/pages/dashboards/ProviderDashboard';
import { SafetyManagementDashboard } from '@/src/pages/dashboards/SafetyManagementDashboard';
import { TouristDashboard } from '@/src/pages/dashboards/TouristDashboard';
import { AccessibilityPage } from '@/src/pages/features/AccessibilityPage';
import { BookingsPage } from '@/src/pages/features/BookingsPage';
import { BudgetTrackerPage } from '@/src/pages/features/BudgetTrackerPage';
import { CapeSafeAIPage } from '@/src/pages/features/CapeSafeAIPage';
import { ChallengesPage } from '@/src/pages/features/ChallengesPage';
import { CheckInPage } from '@/src/pages/features/CheckInPage';
import { CommunityHubPage } from '@/src/pages/features/CommunityHubPage';
import { DigitalPassPage } from '@/src/pages/features/DigitalPassPage';
import { ExplorePage } from '@/src/pages/features/ExplorePage';
import { MyTripsPage } from '@/src/pages/features/MyTripsPage';
import { NotificationsPage } from '@/src/pages/features/NotificationsPage';
import { SafetyCentrePage } from '@/src/pages/features/SafetyCentrePage';
import { SettingsPage } from '@/src/pages/features/SettingsPage';
import { TransportPage } from '@/src/pages/features/TransportPage';
import { LandingPage } from '@/src/pages/LandingPage';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { authService } from '@/src/services/firebase/authService';
import { dataService } from '@/src/services/firebase/dataService';
import { offlineTravelService } from '@/src/services/offlineTravelService';
import { fetchCapeTownWeather } from '@/src/services/weatherService';
import type {
  AiPlannerStop,
  AnnouncementCategory,
  AttractionItem,
  AuthView,
  BookingItem,
  BudgetExpense,
  CapeTownWeather,
  CheckInSession,
  CommunityPost,
  DemoUser,
  DestinationAnnouncement,
  ModerationStatus,
  NavSectionId,
  OfflineTravelBundle,
  PreferredLanguage,
  ProviderApplication,
  ProviderListing,
  ReviewItem,
  SafetyAdvisory,
  TransportRoute,
  TripActivity,
  TrustedContact,
  UserRole,
} from '@/src/types/app';

export default function App() {
  const initialSnapshot = dataService.getInitialSnapshot();

  const [view, setView] = useState<AuthView>('landing');
  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [adminPreviewRole, setAdminPreviewRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<DemoUser>({
    ...DEMO_USERS[0],
    authMode: 'demo',
    emailVerified: true,
  });

  // Shared state (synced from Firestore when authenticated + verified, or demo snapshot otherwise)
  const [attractions] = useState(initialSnapshot.attractions);
  const [bookings, setBookings] = useState(initialSnapshot.bookings);
  const [tripActivities, setTripActivities] = useState(initialSnapshot.tripActivities);
  const [advisories, setAdvisories] = useState(initialSnapshot.advisories);
  const [checkIns, setCheckIns] = useState(initialSnapshot.checkIns);
  const [transportRoutes] = useState(initialSnapshot.transportRoutes);
  const [expenses, setExpenses] = useState(initialSnapshot.expenses);
  const [communityPosts, setCommunityPosts] = useState(initialSnapshot.communityPosts);
  const [reviews, setReviews] = useState<ReviewItem[]>([
    {
      id: 'rev-demo-1',
      authorId: 'demo-tourist-1',
      authorName: 'Maya van der Merwe',
      targetId: 'attr-kirstenbosch',
      rating: 5,
      comment: 'Smooth step-free boardwalk access along the Boomslang canopy and helpful morning shuttle staff.',
      createdAtLabel: 'Today · 09:10 SAST',
      dataOrigin: 'demo',
    },
  ]);
  const [accessibilityRoutes] = useState(initialSnapshot.accessibilityRoutes);
  const [challenges, setChallenges] = useState(initialSnapshot.challenges);
  const [notifications, setNotifications] = useState(initialSnapshot.notifications);
  const [providerApplications, setProviderApplications] = useState(
    initialSnapshot.providerApplications
  );
  const [providerListings, setProviderListings] = useState(initialSnapshot.providerListings);
  const [managedUsers, setManagedUsers] = useState<DemoUser[]>(DEMO_USERS);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>(
    initialSnapshot.trustedContacts
  );
  const [announcements, setAnnouncements] = useState<DestinationAnnouncement[]>(
    initialSnapshot.announcements
  );
  const [weather, setWeather] = useState<CapeTownWeather>({
    temperatureC: 21,
    windSpeedKmh: 19,
    windGustsKmh: 31,
    conditionLabel: 'Partly Cloudy · Atlantic Breeze',
    cablewayRisk: 'Moderate',
    observedAtLabel: 'Loading...',
    dataOrigin: 'demo',
  });
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [offlineBundle, setOfflineBundle] = useState<OfflineTravelBundle | null>(() =>
    offlineTravelService.loadBundle()
  );
  const isOnline = useOnlineStatus();

  const isFirebaseVerified =
    currentUser.authMode === 'firebase' && Boolean(currentUser.emailVerified);
  const activePortalRole: UserRole =
    currentUser.authMode === 'firebase' && currentUser.role === 'admin'
      ? (adminPreviewRole ?? 'admin')
      : currentUser.role;

  // Listen for Google Maps Platform Case A quota exhaustion events
  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Load live Cape Town meteorological conditions from Open-Meteo (with labeled fallback)
  useEffect(() => {
    let active = true;
    void fetchCapeTownWeather().then((res) => {
      if (active) setWeather(res);
    });
    return () => {
      active = false;
    };
  }, []);

  // Subscribe to Firebase Auth changes on boot
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthChanges((firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        setAdminPreviewRole(null);
        setActiveSection('dashboard');
        setView('app');
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to live Firestore collections once authenticated & verified
  useEffect(() => {
    if (!isFirebaseVerified) return;

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      dataService.subscribeUserBookings(currentUser.id, (liveBookings) => {
        if (liveBookings.length > 0) setBookings(liveBookings);
      }),
      dataService.subscribeItineraries(currentUser.id, (liveTrips) => {
        if (liveTrips.length > 0) setTripActivities(liveTrips);
      }),
      dataService.subscribeNotifications(currentUser.id, (liveNotes) => {
        if (liveNotes.length > 0) setNotifications(liveNotes);
      }),
      dataService.subscribeTravelBudgets(currentUser.id, (liveBudgets) => {
        if (liveBudgets.length > 0) setExpenses(liveBudgets);
      }),
      dataService.subscribeUserCheckIns(currentUser.id, (liveCheckIns) => {
        if (liveCheckIns.length > 0) setCheckIns(liveCheckIns);
      }),
      dataService.subscribeTrustedContacts(currentUser.id, (liveContacts) => {
        if (liveContacts.length > 0) setTrustedContacts(liveContacts);
      }),
      dataService.subscribeIncidents((liveIncidents) => {
        if (liveIncidents.length > 0) setAdvisories(liveIncidents);
      }),
      dataService.subscribeAnnouncements((liveAnnouncements) => {
        if (liveAnnouncements.length > 0) setAnnouncements(liveAnnouncements);
      }),
      dataService.subscribeCommunityPosts((livePosts) => {
        if (livePosts.length > 0) setCommunityPosts(livePosts);
      }),
      dataService.subscribeReviews((liveReviews) => {
        if (liveReviews.length > 0) setReviews(liveReviews);
      }),
      dataService.subscribeBusinesses((liveBusinesses) => {
        if (liveBusinesses.length > 0) setProviderApplications(liveBusinesses);
      }),
      dataService.subscribeOfferings((liveOfferings) => {
        if (liveOfferings.length > 0) {
          setProviderListings((prev) => {
            const demoOnes = prev.filter((item) => item.dataOrigin === 'demo');
            const liveIds = new Set(liveOfferings.map((item) => item.id));
            return [...liveOfferings, ...demoOnes.filter((d) => !liveIds.has(d.id))];
          });
        }
      }),
      dataService.subscribeChallengeProgress(currentUser.id, (progressMap) => {
        if (Object.keys(progressMap).length > 0) {
          setChallenges((prev) =>
            prev.map((ch) =>
              progressMap[ch.id]
                ? {
                    ...ch,
                    progress: Math.min(ch.target, progressMap[ch.id].progress),
                    dataOrigin: 'live',
                  }
                : ch
            )
          );
        }
      })
    );

    if (currentUser.role === 'provider') {
      unsubscribers.push(
        dataService.subscribeProviderBookings(currentUser.id, (providerLive) => {
          if (providerLive.length > 0) {
            setBookings((prev) => {
              const map = new Map(prev.map((b) => [b.id, b]));
              providerLive.forEach((b) => map.set(b.id, b));
              return Array.from(map.values());
            });
          }
        })
      );
    }

    if (currentUser.role === 'admin' && currentUser.email.toLowerCase() === 'emihletom07@gmail.com') {
      unsubscribers.push(
        dataService.subscribeAdminUsers((liveUsers) => {
          if (liveUsers.length > 0) setManagedUsers(liveUsers);
        }),
        dataService.subscribeAllBookingsAdmin((adminLiveBookings) => {
          if (adminLiveBookings.length > 0) {
            setBookings((prev) => {
              const map = new Map(prev.map((b) => [b.id, b]));
              adminLiveBookings.forEach((b) => map.set(b.id, b));
              return Array.from(map.values());
            });
          }
        })
      );
    }

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [isFirebaseVerified, currentUser.id, currentUser.role, currentUser.email]);

  // Keep offline saved packet refreshed while online
  useEffect(() => {
    if (!isOnline) return;
    const saved = offlineTravelService.saveBundle({
      user: currentUser,
      bookings,
      activities: tripActivities,
      transportRoutes,
      accessibilityRoutes,
      advisories,
      announcements,
      weather,
    });
    setOfflineBundle(saved);
  }, [
    isOnline,
    currentUser,
    bookings,
    tripActivities,
    transportRoutes,
    accessibilityRoutes,
    advisories,
    announcements,
    weather,
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleEnterDemoRole = (role: UserRole, section: NavSectionId = 'dashboard') => {
    const matched = DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[0];
    setAdminPreviewRole(null);
    setCurrentUser({ ...matched, authMode: 'demo', emailVerified: true });
    setActiveSection(section);
    setView('app');
    window.scrollTo({ top: 0 });
  };

  const handleSwitchRole = (role: UserRole) => {
    if (currentUser.authMode === 'firebase' && currentUser.role === 'admin') {
      setAdminPreviewRole(role);
      return;
    }
    const matched = DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[0];
    setAdminPreviewRole(null);
    setCurrentUser({ ...matched, authMode: 'demo', emailVerified: true });
  };

  const handleAuthenticated = (user: DemoUser) => {
    setAdminPreviewRole(null);
    setCurrentUser(user);
    setActiveSection('dashboard');
    setView('app');
    window.scrollTo({ top: 0 });
  };

  const handleSignOut = async () => {
    if (currentUser.authMode === 'firebase') {
      await authService.signOutFirebase();
    }
    setAdminPreviewRole(null);
    setCurrentUser({ ...DEMO_USERS[0], authMode: 'demo', emailVerified: true });
    setView('login');
    window.scrollTo({ top: 0 });
  };

  // --- Feature Handlers (Write to Firestore when live & verified, else local demo state) ---

  const handleAddToTripFromExplore = async (attraction: AttractionItem) => {
    const newStop: Omit<TripActivity, 'id' | 'completed' | 'dataOrigin'> = {
      day: 3,
      dayLabel: 'Day 3 · Table Mountain & Waterfront',
      time: '15:00',
      title: attraction.title,
      zone: attraction.precinct,
      transportNote: 'Check Transport tab for MyCiTi or shuttle bay',
      safetyNote: attraction.safetyStatus,
    };

    if (isFirebaseVerified) {
      await dataService.addItineraryItem(currentUser.id, newStop);
    } else {
      setTripActivities((prev) => [
        ...prev,
        { ...newStop, id: `tr-${Date.now()}`, completed: false, dataOrigin: 'demo' },
      ]);
    }
  };

  const handleAddReview = async (targetId: string, rating: number, comment: string) => {
    if (isFirebaseVerified) {
      await dataService.addReview(currentUser.id, currentUser.name, targetId, rating, comment);
    } else {
      setReviews((prev) => [
        {
          id: `rev-${Date.now()}`,
          authorId: currentUser.id,
          authorName: currentUser.name,
          targetId,
          rating,
          comment,
          createdAtLabel: 'Just now',
          dataOrigin: 'demo',
        },
        ...prev,
      ]);
    }
  };

  // Strict invariant: new bookings ALWAYS enter Pending Verification until confirmed by provider/authorized integration
  const handleCreateBooking = async (
    booking: Omit<BookingItem, 'id' | 'status' | 'dataOrigin'>
  ) => {
    if (isFirebaseVerified) {
      await dataService.createBooking(currentUser.id, booking);
      await dataService.createNotification(currentUser.id, {
        title: `Booking Requested: ${booking.title}`,
        detail: `Submitted for ${booking.date} (${booking.durationValue ?? 1} ${booking.durationUnit ?? 'sessions'}). Status: Pending Verification until ${booking.providerName} confirms.`,
        category: 'Booking',
      });
    } else {
      const newBooking: BookingItem = {
        ...booking,
        id: `bk-${Date.now()}`,
        userId: currentUser.id,
        status: 'Pending Verification',
        dataOrigin: 'demo',
      };
      setBookings((prev) => [newBooking, ...prev]);
      setNotifications((prev) => [
        {
          id: `not-${Date.now()}`,
          userId: currentUser.id,
          title: `Booking Requested: ${booking.title}`,
          detail: `Awaiting confirmation from ${booking.providerName} before locking into Trips & Digital Pass.`,
          category: 'Booking',
          timestamp: 'Just now',
          read: false,
          dataOrigin: 'demo',
        },
        ...prev,
      ]);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: string,
    status: BookingItem['status'],
    meta?: { confirmedBy?: string; cancellationReason?: string }
  ) => {
    const target = bookings.find((b) => b.id === bookingId);
    const unitsDelta = target
      ? target.pricingModel === 'per_unit'
        ? 1
        : Math.max(1, target.guests || 1)
      : 0;
    const isConfirming = target && target.status !== 'Confirmed' && status === 'Confirmed';
    const isCancellingConfirmed = target && target.status === 'Confirmed' && status === 'Cancelled';

    const linkedOffering = target?.offeringId
      ? providerListings.find((o) => o.id === target.offeringId)
      : undefined;

    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.updateBookingStatus(bookingId, status, meta);
      if (linkedOffering && linkedOffering.dataOrigin === 'live' && (isConfirming || isCancellingConfirmed)) {
        const nextBooked = isConfirming
          ? Math.min(linkedOffering.capacity, linkedOffering.bookedSeats + unitsDelta)
          : Math.max(0, linkedOffering.bookedSeats - unitsDelta);
        await dataService.updateProviderOffering(linkedOffering.id, { bookedSeats: nextBooked });
      }
      if (
        target.userId === currentUser.id ||
        currentUser.role === 'admin' ||
        currentUser.role === 'safety'
      ) {
        const targetUid = target.userId || currentUser.id;
        await dataService.createNotification(targetUid, {
          title: `Booking ${status}: ${target.title}`,
          detail:
            status === 'Confirmed'
              ? `Confirmed by ${meta?.confirmedBy || target.providerName}. Now eligible for My Trips and Digital Tourist Pass.`
              : status === 'Cancelled'
              ? `Reservation cancelled.${meta?.cancellationReason ? ` Reason: ${meta.cancellationReason}` : ''}`
              : `Reservation status updated to ${status}.`,
          category: 'Booking',
        });
      }
    } else {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status,
                confirmedBy: meta?.confirmedBy ?? b.confirmedBy,
                cancellationReason: meta?.cancellationReason ?? b.cancellationReason,
              }
            : b
        )
      );
      if (linkedOffering && (isConfirming || isCancellingConfirmed)) {
        setProviderListings((prev) =>
          prev.map((l) => {
            if (l.id !== linkedOffering.id) return l;
            const nextBooked = isConfirming
              ? Math.min(l.capacity, l.bookedSeats + unitsDelta)
              : Math.max(0, l.bookedSeats - unitsDelta);
            return { ...l, bookedSeats: nextBooked };
          })
        );
      }
      if (target) {
        setNotifications((prev) => [
          {
            id: `not-${Date.now()}`,
            userId: currentUser.id,
            title: `Booking ${status}: ${target.title}`,
            detail:
              status === 'Confirmed'
                ? `Confirmed by ${meta?.confirmedBy || target.providerName}.`
                : `Reservation status updated to ${status}.`,
            category: 'Booking',
            timestamp: 'Just now',
            read: false,
            dataOrigin: 'demo',
          },
          ...prev,
        ]);
      }
    }
  };

  const handleCancelBooking = async (bookingId: string, reason?: string) => {
    await handleUpdateBookingStatus(bookingId, 'Cancelled', {
      cancellationReason: reason || 'Cancelled by tourist',
    });
  };

  const handleToggleActivity = async (id: string) => {
    const target = tripActivities.find((a) => a.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.toggleItineraryItem(id, !target.completed);
    } else {
      setTripActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a))
      );
    }
  };

  const handleAddActivity = async (
    activity: Omit<TripActivity, 'id' | 'completed' | 'dataOrigin'>
  ) => {
    if (isFirebaseVerified) {
      await dataService.addItineraryItem(currentUser.id, activity);
    } else {
      setTripActivities((prev) => [
        ...prev,
        { ...activity, id: `tr-${Date.now()}`, completed: false, dataOrigin: 'demo' },
      ]);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    const target = tripActivities.find((a) => a.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.deleteItineraryItem(id);
    } else {
      setTripActivities((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleAddRouteToTrip = async (route: TransportRoute) => {
    await handleAddActivity({
      day: 1,
      dayLabel: 'Day 1 · Cape Town Arrival & Transit',
      time: '10:00',
      title: `${route.service}: ${route.routeName}`,
      zone: route.corridor,
      transportNote: `${route.frequency} · ${route.fareZar}`,
      safetyNote: route.accessible ? 'Step-Free Verified' : route.status,
      itemType: 'Transport',
    });
  };

  const handleStartCheckIn = async (session: Omit<CheckInSession, 'id' | 'dataOrigin'>) => {
    if (isFirebaseVerified) {
      await dataService.createCheckIn(currentUser.id, session);
    } else {
      setCheckIns((prev) => [
        { ...session, id: `chk-${Date.now()}`, dataOrigin: 'demo' },
        ...prev,
      ]);
    }
  };

  const handleExtendCheckIn = async (
    id: string,
    nextExpectedReturn: string,
    nextExpectedReturnIso?: string
  ) => {
    const target = checkIns.find((c) => c.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.extendCheckIn(id, nextExpectedReturn, nextExpectedReturnIso);
    } else {
      setCheckIns((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                expectedReturn: nextExpectedReturn,
                expectedReturnIso: nextExpectedReturnIso,
                reminderSent: false,
              }
            : c
        )
      );
    }
  };

  const handleTriggerCheckInReminder = async (session: CheckInSession) => {
    const notePayload = {
      title: `Check-In Reminder: ${session.route}`,
      detail: `Expected return is ${session.expectedReturn}. Confirm Safe Return or extend by +30 min.`,
      category: 'Safety' as const,
    };

    if (isFirebaseVerified && session.dataOrigin === 'live') {
      await dataService.markCheckInReminderSent(session.id);
      await dataService.createNotification(currentUser.id, notePayload);
    } else {
      setCheckIns((prev) =>
        prev.map((c) => (c.id === session.id ? { ...c, reminderSent: true } : c))
      );
      setNotifications((prev) => [
        {
          ...notePayload,
          id: `not-${Date.now()}`,
          timestamp: 'Just now',
          read: false,
          dataOrigin: 'demo',
        },
        ...prev,
      ]);
    }
  };

  const handleCompleteCheckIn = async (id: string) => {
    const target = checkIns.find((c) => c.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.completeCheckIn(id);
    } else {
      setCheckIns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Completed' } : c))
      );
    }
  };

  const handleAddTrustedContact = async (
    contact: Omit<TrustedContact, 'id' | 'uid' | 'dataOrigin'>
  ) => {
    if (isFirebaseVerified) {
      await dataService.addTrustedContact(currentUser.id, contact);
    } else {
      setTrustedContacts((prev) => [
        ...prev,
        { ...contact, id: `tc-${Date.now()}`, uid: currentUser.id, dataOrigin: 'demo' },
      ]);
    }
  };

  const handleDeleteTrustedContact = async (id: string) => {
    const target = trustedContacts.find((c) => c.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.deleteTrustedContact(currentUser.id, id);
    } else {
      setTrustedContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handlePublishAdvisory = async (
    advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>
  ) => {
    if (isFirebaseVerified) {
      await dataService.createIncident(currentUser.id, advisory);
    } else {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')} SAST`;
      setAdvisories((prev) => [
        { ...advisory, id: `adv-${Date.now()}`, updatedAt: timeStr, dataOrigin: 'demo' },
        ...prev,
      ]);
    }
  };

  const handleUpdateIncident = async (
    incidentId: string,
    updates: {
      status?: SafetyAdvisory['status'];
      severity?: SafetyAdvisory['severity'];
      assignedOfficerId?: string;
      assignedOfficerName?: string;
      resolutionNotes?: string;
    }
  ) => {
    const target = advisories.find((a) => a.id === incidentId);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.updateIncidentStatusAndAssignment(incidentId, updates);
    } else {
      setAdvisories((prev) =>
        prev.map((a) => (a.id === incidentId ? { ...a, ...updates } : a))
      );
    }
  };

  const handleRevokeIncidentLocation = async (incidentId: string) => {
    const target = advisories.find((a) => a.id === incidentId);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.revokeIncidentLocation(incidentId);
    } else {
      setAdvisories((prev) =>
        prev.map((a) =>
          a.id === incidentId
            ? {
                ...a,
                locationConsent: false,
                sharedLat: undefined,
                sharedLng: undefined,
                locationLabel: undefined,
              }
            : a
        )
      );
    }
  };

  const handleCreateAnnouncement = async (payload: {
    title: string;
    category: AnnouncementCategory;
    zone: string;
    body: string;
    priority: DestinationAnnouncement['priority'];
    pinned: boolean;
  }) => {
    if (isFirebaseVerified) {
      await dataService.createAnnouncement(currentUser.id, currentUser.name, payload);
    } else {
      setAnnouncements((prev) => [
        {
          id: `ann-${Date.now()}`,
          authorId: currentUser.id,
          authorName: currentUser.name,
          ...payload,
          active: true,
          updatedAtLabel: 'Just now',
          dataOrigin: 'demo',
        },
        ...prev,
      ]);
    }
  };

  const handleUpdateAnnouncement = async (
    id: string,
    updates: Partial<Pick<DestinationAnnouncement, 'pinned' | 'active'>>
  ) => {
    const target = announcements.find((a) => a.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.updateAnnouncement(id, updates);
    } else {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      );
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const target = announcements.find((a) => a.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.deleteAnnouncement(id);
    } else {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleAddPost = async (post: Omit<CommunityPost, 'id' | 'timestamp' | 'dataOrigin'>) => {
    if (isFirebaseVerified) {
      await dataService.createCommunityPost(currentUser.id, post);
    } else {
      setCommunityPosts((prev) => [
        { ...post, id: `com-${Date.now()}`, timestamp: 'Just now', dataOrigin: 'demo' },
        ...prev,
      ]);
    }
  };

  const handleFlagPost = async (postId: string, reason: string) => {
    const target = communityPosts.find((p) => p.id === postId);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.flagCommunityPost(postId, currentUser.id, reason);
    } else {
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, moderationStatus: 'Under Review', flaggedBy: currentUser.id, flagReason: reason }
            : p
        )
      );
    }
  };

  const handleModeratePost = async (
    postId: string,
    moderationStatus: ModerationStatus,
    verifiedGuide?: boolean
  ) => {
    const target = communityPosts.find((p) => p.id === postId);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.moderateCommunityPost(postId, currentUser.id, moderationStatus, {
        ...(typeof verifiedGuide === 'boolean' ? { verifiedGuide } : {}),
      });
    } else {
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                moderationStatus,
                moderatedBy: currentUser.id,
                ...(typeof verifiedGuide === 'boolean' ? { verifiedGuide } : {}),
              }
            : p
        )
      );
    }
  };

  const handleDeletePost = async (postId: string) => {
    const target = communityPosts.find((p) => p.id === postId);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.deleteCommunityPost(postId);
    } else {
      setCommunityPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handleAddExpense = async (expense: Omit<BudgetExpense, 'id' | 'dataOrigin'>) => {
    if (isFirebaseVerified) {
      await dataService.addBudgetExpense(currentUser.id, expense);
    } else {
      setExpenses((prev) => [
        { ...expense, id: `exp-${Date.now()}`, dataOrigin: 'demo' },
        ...prev,
      ]);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.deleteBudgetExpense(id);
    } else {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleSyncPassId = async (nextPassId: string) => {
    if (isFirebaseVerified) {
      await dataService.updateUserPassId(currentUser.id, nextPassId);
    }
    setCurrentUser((prev) => ({ ...prev, passId: nextPassId }));
  };

  const handleIncrementChallenge = async (id: string) => {
    const target = challenges.find((c) => c.id === id);
    if (!target) return;
    const updated = {
      ...target,
      progress: Math.min(target.target, target.progress + 1),
    };
    setChallenges((prev) => prev.map((ch) => (ch.id === id ? updated : ch)));
    if (isFirebaseVerified) {
      await dataService.upsertChallengeProgress(currentUser.id, updated);
    }
  };

  const handleAddAiStopToTrip = async (stop: AiPlannerStop) => {
    await handleAddActivity({
      day: stop.day,
      dayLabel: stop.dayLabel,
      time: stop.time,
      title: stop.title,
      zone: stop.zone,
      transportNote: stop.transportNote,
      safetyNote: stop.safetyNote,
      itemType: stop.itemType,
    });
  };

  const handleToggleAccessibilityPriority = async (enabled: boolean) => {
    setCurrentUser((prev) => ({ ...prev, accessibilityPriority: enabled }));
    if (isFirebaseVerified) {
      await dataService.updateUserProfile(currentUser.id, { accessibilityPriority: enabled });
    }
  };

  const handleUpdatePreferredLanguage = async (preferredLanguage: PreferredLanguage) => {
    setCurrentUser((prev) => ({ ...prev, preferredLanguage }));
    if (isFirebaseVerified) {
      await dataService.updateUserProfile(currentUser.id, { preferredLanguage });
    }
  };

  const handleSaveOfflineBundle = (): OfflineTravelBundle => {
    const saved = offlineTravelService.saveBundle({
      user: currentUser,
      bookings,
      activities: tripActivities,
      transportRoutes,
      accessibilityRoutes,
      advisories,
      announcements,
      weather,
    });
    setOfflineBundle(saved);
    return saved;
  };

  const handleClearOfflineBundle = () => {
    offlineTravelService.clearBundle();
    setOfflineBundle(null);
  };

  const handleMarkNotificationRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.markNotificationRead(id);
    } else {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (isFirebaseVerified) {
      const unreadLive = notifications.filter((n) => !n.read && n.dataOrigin === 'live');
      await Promise.all(unreadLive.map((n) => dataService.markNotificationRead(n.id)));
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleUpdateApplicationStatus = async (
    id: string,
    status: ProviderApplication['status']
  ) => {
    const target = providerApplications.find((a) => a.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.updateBusinessStatus(id, status);
    } else {
      setProviderApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    }
  };

  const handleUpdateUserRole = async (uid: string, role: UserRole) => {
    const target = managedUsers.find((u) => u.id === uid);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.adminUpdateUserRole(uid, role);
    } else {
      setManagedUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role } : u)));
    }
  };

  const handleCreateOffering = async (
    offering: Omit<ProviderListing, 'id' | 'providerId' | 'providerName' | 'dataOrigin'>
  ) => {
    const providerLabel = currentUser.organization || currentUser.name;
    if (isFirebaseVerified && (currentUser.role === 'provider' || currentUser.role === 'admin')) {
      await dataService.createProviderOffering(currentUser.id, providerLabel, offering);
    } else {
      setProviderListings((prev) => [
        {
          ...offering,
          id: `lst-${Date.now()}`,
          providerId: currentUser.id,
          providerName: providerLabel,
          dataOrigin: 'demo',
        },
        ...prev,
      ]);
    }
  };

  const handleUpdateOffering = async (id: string, updates: Partial<ProviderListing>) => {
    const target = providerListings.find((l) => l.id === id);
    if (isFirebaseVerified && target && target.dataOrigin === 'live') {
      await dataService.updateProviderOffering(id, updates);
    } else {
      setProviderListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
    }
  };

  const handleToggleListingStatus = async (id: string) => {
    const target = providerListings.find((l) => l.id === id);
    if (!target) return;
    await handleUpdateOffering(id, {
      status: target.status === 'Active' ? 'Paused' : 'Active',
    });
  };

  const handleCompleteChecklist = async (id: string) => {
    await handleUpdateOffering(id, { safetyChecklistComplete: true });
  };

  const handleSubmitAccreditation = async (payload: {
    businessName: string;
    category: string;
    zone: string;
    complianceDocs: string;
    description?: string;
    lat?: number;
    lng?: number;
    imageUrl?: string;
    safetyChecklistComplete: boolean;
  }) => {
    if (isFirebaseVerified) {
      await dataService.createBusinessApplication(currentUser.id, payload);
    } else {
      setProviderApplications((prev) => [
        {
          id: `biz-${Date.now()}`,
          ownerId: currentUser.id,
          businessName: payload.businessName,
          category: payload.category,
          zone: payload.zone,
          complianceDocs: payload.complianceDocs,
          description: payload.description,
          lat: payload.lat,
          lng: payload.lng,
          imageUrl: payload.imageUrl,
          submittedDate: 'Just now',
          status: 'Pending Review',
          safetyChecklistComplete: payload.safetyChecklistComplete,
          dataOrigin: 'demo',
        },
        ...prev,
      ]);
    }
  };

  const handleUpdateUser = (updates: Partial<DemoUser>) => {
    setCurrentUser((prev) => ({ ...prev, ...updates }));
  };

  const renderDashboardByRole = () => {
    switch (activePortalRole) {
      case 'admin':
        return (
          <AdminDashboard
            user={currentUser}
            applications={providerApplications}
            managedUsers={managedUsers}
            advisories={advisories}
            announcements={announcements}
            onUpdateApplicationStatus={handleUpdateApplicationStatus}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateIncident={handleUpdateIncident}
            onCreateAnnouncement={handleCreateAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onNavigate={setActiveSection}
          />
        );
      case 'provider':
        return (
          <ProviderDashboard
            user={currentUser}
            listings={providerListings}
            bookings={bookings}
            onToggleListingStatus={handleToggleListingStatus}
            onCompleteChecklist={handleCompleteChecklist}
            onCreateOffering={handleCreateOffering}
            onUpdateOffering={handleUpdateOffering}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onSubmitAccreditation={handleSubmitAccreditation}
            onNavigate={setActiveSection}
          />
        );
      case 'safety':
        return (
          <SafetyManagementDashboard
            user={currentUser}
            checkIns={checkIns}
            advisories={advisories}
            onResolveCheckIn={handleCompleteCheckIn}
            onPublishAdvisory={handlePublishAdvisory}
            onUpdateIncident={handleUpdateIncident}
            onNavigate={setActiveSection}
          />
        );
      case 'tourist':
      default:
        return (
          <TouristDashboard
            user={currentUser}
            attractions={attractions}
            bookings={bookings}
            tripActivities={tripActivities}
            advisories={advisories}
            announcements={announcements}
            weather={weather}
            checkIns={checkIns}
            expenses={expenses}
            onNavigate={setActiveSection}
          />
        );
    }
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboardByRole();
      case 'explore':
        return (
          <ExplorePage
            attractions={attractions}
            businesses={providerApplications}
            advisories={advisories}
            reviews={reviews}
            onAddToTrip={handleAddToTripFromExplore}
            onAddReview={handleAddReview}
          />
        );
      case 'bookings':
        return (
          <BookingsPage
            user={currentUser}
            bookings={bookings}
            offerings={providerListings}
            onCreateBooking={handleCreateBooking}
            onCancelBooking={handleCancelBooking}
            onNavigate={setActiveSection}
          />
        );
      case 'trips':
        return (
          <MyTripsPage
            user={currentUser}
            activities={tripActivities}
            bookings={bookings}
            onToggleActivity={handleToggleActivity}
            onAddActivity={handleAddActivity}
            onDeleteActivity={handleDeleteActivity}
            onNavigate={setActiveSection}
          />
        );
      case 'safety':
        return (
          <SafetyCentrePage
            user={currentUser}
            advisories={advisories}
            announcements={announcements}
            weather={weather}
            onReportIncident={handlePublishAdvisory}
            onRevokeIncidentLocation={handleRevokeIncidentLocation}
          />
        );
      case 'check-in':
        return (
          <CheckInPage
            user={currentUser}
            checkIns={checkIns}
            trustedContacts={trustedContacts}
            onStartCheckIn={handleStartCheckIn}
            onExtendCheckIn={handleExtendCheckIn}
            onTriggerCheckInReminder={handleTriggerCheckInReminder}
            onCompleteCheckIn={handleCompleteCheckIn}
            onAddTrustedContact={handleAddTrustedContact}
            onDeleteTrustedContact={handleDeleteTrustedContact}
          />
        );
      case 'transport':
        return (
          <TransportPage
            routes={transportRoutes}
            transportOfferings={providerListings.filter((l) => l.offeringType === 'Transport')}
            weather={weather}
            onAddRouteToTrip={handleAddRouteToTrip}
            onNavigate={setActiveSection}
          />
        );
      case 'ai-assistant':
        return (
          <CapeSafeAIPage
            user={currentUser}
            weather={weather}
            advisories={advisories}
            announcements={announcements}
            attractions={attractions}
            bookings={bookings}
            activities={tripActivities}
            onAddAiStopToTrip={handleAddAiStopToTrip}
            onUpdateLanguage={handleUpdatePreferredLanguage}
            onNavigate={setActiveSection}
          />
        );
      case 'community':
        return (
          <CommunityHubPage
            user={currentUser}
            posts={communityPosts}
            onAddPost={handleAddPost}
            onFlagPost={handleFlagPost}
            onModeratePost={handleModeratePost}
            onDeletePost={handleDeletePost}
          />
        );
      case 'budget':
        return (
          <BudgetTrackerPage
            user={currentUser}
            expenses={expenses}
            bookings={bookings}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        );
      case 'pass':
        return (
          <DigitalPassPage
            user={currentUser}
            bookings={bookings}
            checkIns={checkIns}
            onSyncPassId={handleSyncPassId}
          />
        );
      case 'accessibility':
        return (
          <AccessibilityPage
            user={currentUser}
            routes={accessibilityRoutes}
            attractions={attractions}
            transportRoutes={transportRoutes}
            offerings={providerListings}
            onToggleAccessibilityPriority={handleToggleAccessibilityPriority}
            onAddToTrip={handleAddToTripFromExplore}
            onNavigate={setActiveSection}
          />
        );
      case 'challenges':
        return (
          <ChallengesPage
            user={currentUser}
            challenges={challenges}
            bookings={bookings}
            checkIns={checkIns}
            activities={tripActivities}
            onIncrementChallenge={handleIncrementChallenge}
          />
        );
      case 'notifications':
        return (
          <NotificationsPage
            notifications={notifications}
            onMarkRead={handleMarkNotificationRead}
            onMarkAllRead={handleMarkAllNotificationsRead}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            user={currentUser}
            offlineBundle={offlineBundle}
            onUpdateUser={handleUpdateUser}
            onSaveOfflineBundle={handleSaveOfflineBundle}
            onClearOfflineBundle={handleClearOfflineBundle}
          />
        );
      default:
        return renderDashboardByRole();
    }
  };

  return (
    <>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {view === 'landing' && (
        <LandingPage
          onOpenAuth={(mode) => {
            setView(mode);
            window.scrollTo({ top: 0 });
          }}
          onEnterDemoRole={handleEnterDemoRole}
        />
      )}

      {(view === 'login' || view === 'register') && (
        <AuthPages
          mode={view}
          onSwitchMode={(mode) => setView(mode)}
          onBackLanding={() => {
            setView('landing');
            window.scrollTo({ top: 0 });
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {view === 'app' && (
        <AppShell
          user={currentUser}
          activePortalRole={activePortalRole}
          activeSection={activeSection}
          unreadNotifications={unreadCount}
          onSelectSection={(section) => {
            setActiveSection(section);
            window.scrollTo({ top: 0 });
          }}
          onSwitchRole={handleSwitchRole}
          onResendVerification={() => authService.resendVerificationEmail()}
          onRefreshVerification={async () => {
            const refreshed = await authService.refreshVerificationStatus();
            if (refreshed) setCurrentUser(refreshed);
          }}
          onGoLanding={() => {
            setView('landing');
            window.scrollTo({ top: 0 });
          }}
          onSignOut={handleSignOut}
        >
          {renderActiveSection()}
        </AppShell>
      )}

      <OfflineIndicator
        offlineBundle={offlineBundle}
        onOpenOfflineSettings={() => {
          if (view === 'app') {
            setActiveSection('settings');
          }
        }}
      />
    </>
  );
}
