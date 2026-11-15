import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEMO_ACCESSIBILITY_ROUTES,
  DEMO_ANNOUNCEMENTS,
  DEMO_ATTRACTIONS,
  DEMO_BOOKINGS,
  DEMO_CHALLENGES,
  DEMO_CHECKINS,
  DEMO_COMMUNITY_POSTS,
  DEMO_EXPENSES,
  DEMO_NOTIFICATIONS,
  DEMO_PROVIDER_APPLICATIONS,
  DEMO_PROVIDER_LISTINGS,
  DEMO_SAFETY_ADVISORIES,
  DEMO_TRANSPORT_ROUTES,
  DEMO_TRIP_ACTIVITIES,
  DEMO_TRUSTED_CONTACTS,
} from '@/src/data/demoData';
import type {
  AnnouncementCategory,
  BookingItem,
  BudgetExpense,
  ChallengeItem,
  CheckInSession,
  CommunityPost,
  DemoUser,
  DestinationAnnouncement,
  DurationUnit,
  IncidentCategory,
  ModerationStatus,
  NotificationItem,
  OfferingType,
  PreferredLanguage,
  PricingModel,
  ProfileVisibility,
  ProviderApplication,
  ProviderListing,
  ReviewItem,
  SafetyAdvisory,
  TripActivity,
  TrustedContact,
  UserRole,
} from '@/src/types/app';
import { auth, db, FIREBASE_COLLECTIONS, isFirebaseConfigured } from './config';
import { handleFirestoreError, OperationType } from './errorHandler';

function clamp(val: string, max: number): string {
  return val.trim().slice(0, max);
}

function formatTimestamp(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    const d = (ts as { toDate: () => Date }).toDate();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} SAST`;
  }
  return 'Just now';
}

export const dataService = {
  collections: FIREBASE_COLLECTIONS,
  isLiveFirestore: isFirebaseConfigured(),

  getInitialSnapshot() {
    return {
      attractions: DEMO_ATTRACTIONS,
      bookings: DEMO_BOOKINGS,
      tripActivities: DEMO_TRIP_ACTIVITIES,
      advisories: DEMO_SAFETY_ADVISORIES,
      checkIns: DEMO_CHECKINS,
      transportRoutes: DEMO_TRANSPORT_ROUTES,
      expenses: DEMO_EXPENSES,
      communityPosts: DEMO_COMMUNITY_POSTS,
      accessibilityRoutes: DEMO_ACCESSIBILITY_ROUTES,
      challenges: DEMO_CHALLENGES,
      notifications: DEMO_NOTIFICATIONS,
      providerApplications: DEMO_PROVIDER_APPLICATIONS,
      providerListings: DEMO_PROVIDER_LISTINGS,
      trustedContacts: DEMO_TRUSTED_CONTACTS,
      announcements: DEMO_ANNOUNCEMENTS,
    };
  },

  // --- User Profile & RBAC ---
  async updateUserProfile(
    uid: string,
    updates: {
      displayName?: string;
      location?: string;
      organization?: string;
      photoUrl?: string;
      emergencyContact?: string;
      accessibilityPriority?: boolean;
      profileVisibility?: ProfileVisibility;
      shareLocationConsent?: boolean;
      aiContextPersonalization?: boolean;
      preferredLanguage?: PreferredLanguage;
    }
  ): Promise<void> {
    const userPath = `${FIREBASE_COLLECTIONS.users}/${uid}`;
    const privatePath = `${userPath}/private/contact`;

    const publicUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.displayName) publicUpdates.displayName = clamp(updates.displayName, 100);
    if (updates.location) publicUpdates.location = clamp(updates.location, 120);
    if (updates.organization) publicUpdates.organization = clamp(updates.organization, 140);
    if (updates.photoUrl) publicUpdates.photoUrl = clamp(updates.photoUrl, 500);
    if (typeof updates.accessibilityPriority === 'boolean') {
      publicUpdates.accessibilityPriority = updates.accessibilityPriority;
    }
    if (updates.profileVisibility) {
      publicUpdates.profileVisibility = updates.profileVisibility;
    }
    if (typeof updates.shareLocationConsent === 'boolean') {
      publicUpdates.shareLocationConsent = updates.shareLocationConsent;
    }
    if (typeof updates.aiContextPersonalization === 'boolean') {
      publicUpdates.aiContextPersonalization = updates.aiContextPersonalization;
    }
    if (updates.preferredLanguage) {
      publicUpdates.preferredLanguage = updates.preferredLanguage;
    }

    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.users, uid), publicUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }

    if (updates.emergencyContact) {
      try {
        await updateDoc(doc(db, FIREBASE_COLLECTIONS.users, uid, 'private', 'contact'), {
          emergencyContact: clamp(updates.emergencyContact, 140),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, privatePath);
      }
    }
  },

  async updateUserPassId(uid: string, passId: string): Promise<void> {
    const privatePath = `${FIREBASE_COLLECTIONS.users}/${uid}/private/contact`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.users, uid, 'private', 'contact'), {
        passId: clamp(passId, 40),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, privatePath);
    }
  },

  async adminUpdateUserRole(targetUid: string, newRole: UserRole): Promise<void> {
    const userPath = `${FIREBASE_COLLECTIONS.users}/${targetUid}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.users, targetUid), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  },

  subscribeAdminUsers(onData: (users: DemoUser[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.users;
    return onSnapshot(
      collection(db, FIREBASE_COLLECTIONS.users),
      (snap) => {
        const list: DemoUser[] = snap.docs.map((d) => {
          const data = d.data();
          const role = (data.role as UserRole) || 'tourist';
          return {
            id: d.id,
            name: String(data.displayName || 'User'),
            email: '',
            role,
            requestedRole: (data.requestedRole as UserRole) || role,
            roleTitle: role,
            organization: String(data.organization || ''),
            location: String(data.location || 'Cape Town'),
            avatarUrl: data.photoUrl ? String(data.photoUrl) : undefined,
            accessibilityPriority: Boolean(data.accessibilityPriority),
            authMode: 'firebase',
            dataOrigin: 'live',
          };
        });
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  },

  // --- 2. Tourism Businesses ---
  subscribeBusinesses(onData: (items: ProviderApplication[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.tourismBusinesses;
    return onSnapshot(
      collection(db, path),
      (snap) => {
        const items: ProviderApplication[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || ''),
            businessName: String(data.businessName || ''),
            category: String(data.category || ''),
            zone: String(data.zone || ''),
            complianceDocs: String(data.complianceDocs || ''),
            description: data.description ? String(data.description) : undefined,
            lat: typeof data.lat === 'number' ? data.lat : undefined,
            lng: typeof data.lng === 'number' ? data.lng : undefined,
            imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
            submittedDate: formatTimestamp(data.createdAt),
            status: (data.status as ProviderApplication['status']) || 'Pending Review',
            safetyChecklistComplete: Boolean(data.safetyChecklistComplete),
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createBusinessApplication(
    uid: string,
    payload: {
      businessName: string;
      category: string;
      zone: string;
      complianceDocs: string;
      description?: string;
      lat?: number;
      lng?: number;
      imageUrl?: string;
      safetyChecklistComplete: boolean;
    }
  ): Promise<void> {
    const ref = doc(collection(db, FIREBASE_COLLECTIONS.tourismBusinesses));
    const path = `${FIREBASE_COLLECTIONS.tourismBusinesses}/${ref.id}`;
    try {
      await setDoc(ref, {
        id: ref.id,
        ownerId: uid,
        businessName: clamp(payload.businessName, 140),
        category: clamp(payload.category, 80),
        zone: clamp(payload.zone, 100),
        complianceDocs: clamp(payload.complianceDocs, 240),
        ...(payload.description ? { description: clamp(payload.description, 500) } : {}),
        ...(typeof payload.lat === 'number' && typeof payload.lng === 'number'
          ? { lat: payload.lat, lng: payload.lng }
          : {}),
        ...(payload.imageUrl ? { imageUrl: clamp(payload.imageUrl, 500) } : {}),
        status: 'Pending Review',
        safetyChecklistComplete: Boolean(payload.safetyChecklistComplete),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateBusinessStatus(businessId: string, status: ProviderApplication['status']): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.tourismBusinesses}/${businessId}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.tourismBusinesses, businessId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- 3. Bookings & Provider Offerings ---
  subscribeOfferings(onData: (items: ProviderListing[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.providerOfferings;
    return onSnapshot(
      collection(db, path),
      (snap) => {
        const items: ProviderListing[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            providerId: String(data.providerId || ''),
            providerName: String(data.providerName || ''),
            offeringType: (data.offeringType as OfferingType) || 'Activity',
            experienceTitle: String(data.experienceTitle || ''),
            category: String(data.category || ''),
            zone: String(data.zone || ''),
            description: data.description ? String(data.description) : undefined,
            durationUnit: (data.durationUnit as DurationUnit) || 'sessions',
            defaultDurationValue: Number(data.defaultDurationValue || 1),
            pricingModel: (data.pricingModel as PricingModel) || 'per_guest',
            nextDeparture: String(data.nextDeparture || '09:00'),
            bookedSeats: Number(data.bookedUnits || 0),
            capacity: Number(data.availableUnits || 1),
            priceZar: Number(data.unitPriceZar || 0),
            accessible: Boolean(data.accessible),
            safetyChecklistComplete: Boolean(data.safetyChecklistComplete),
            status: (data.status as ProviderListing['status']) || 'Active',
            blockedDates: Array.isArray(data.blockedDates)
              ? data.blockedDates.map((x) => String(x))
              : [],
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createProviderOffering(
    uid: string,
    providerName: string,
    offering: Omit<ProviderListing, 'id' | 'providerId' | 'providerName' | 'dataOrigin'>
  ): Promise<void> {
    const ref = doc(collection(db, FIREBASE_COLLECTIONS.providerOfferings));
    const path = `${FIREBASE_COLLECTIONS.providerOfferings}/${ref.id}`;
    try {
      await setDoc(ref, {
        id: ref.id,
        providerId: uid,
        providerName: clamp(providerName, 140),
        offeringType: offering.offeringType || 'Activity',
        experienceTitle: clamp(offering.experienceTitle, 160),
        category: clamp(offering.category || offering.offeringType || 'Experience', 80),
        zone: clamp(offering.zone || 'Cape Town', 120),
        ...(offering.description ? { description: clamp(offering.description, 500) } : {}),
        durationUnit: offering.durationUnit || 'sessions',
        defaultDurationValue: Math.max(1, Math.min(60, Math.round(offering.defaultDurationValue || 1))),
        unitPriceZar: Math.max(0, Number(offering.priceZar)),
        pricingModel: offering.pricingModel || 'per_guest',
        availableUnits: Math.max(1, Math.min(500, Math.round(offering.capacity || 10))),
        bookedUnits: Math.max(0, Math.min(500, Math.round(offering.bookedSeats || 0))),
        nextDeparture: clamp(offering.nextDeparture || '09:00', 80),
        accessible: Boolean(offering.accessible),
        safetyChecklistComplete: Boolean(offering.safetyChecklistComplete),
        status: offering.status || 'Active',
        blockedDates: (offering.blockedDates || []).slice(0, 30).map((d) => clamp(d, 20)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateProviderOffering(
    id: string,
    updates: Partial<ProviderListing>
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.providerOfferings}/${id}`;
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.status) payload.status = updates.status;
    if (typeof updates.safetyChecklistComplete === 'boolean') {
      payload.safetyChecklistComplete = updates.safetyChecklistComplete;
    }
    if (typeof updates.capacity === 'number') {
      payload.availableUnits = Math.max(1, Math.min(500, Math.round(updates.capacity)));
    }
    if (typeof updates.bookedSeats === 'number') {
      payload.bookedUnits = Math.max(0, Math.min(500, Math.round(updates.bookedSeats)));
    }
    if (typeof updates.priceZar === 'number') {
      payload.unitPriceZar = Math.max(0, Number(updates.priceZar));
    }
    if (updates.blockedDates) {
      payload.blockedDates = updates.blockedDates.slice(0, 30).map((d) => clamp(d, 20));
    }
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.providerOfferings, id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  mapBookingDoc(id: string, data: Record<string, unknown>): BookingItem {
    return {
      id,
      userId: String(data.userId || ''),
      providerId: String(data.providerId || ''),
      offeringId: data.offeringId ? String(data.offeringId) : undefined,
      offeringType: data.offeringType ? (data.offeringType as OfferingType) : undefined,
      title: String(data.title || ''),
      providerName: String(data.providerName || ''),
      category: String(data.category || 'Experience'),
      zone: data.zone ? String(data.zone) : undefined,
      date: String(data.date || ''),
      timeSlot: String(data.timeSlot || ''),
      durationUnit: data.durationUnit ? (data.durationUnit as DurationUnit) : undefined,
      durationValue: typeof data.durationValue === 'number' ? data.durationValue : undefined,
      endDate: data.endDate ? String(data.endDate) : undefined,
      endTime: data.endTime ? String(data.endTime) : undefined,
      unitPriceZar: typeof data.unitPriceZar === 'number' ? data.unitPriceZar : undefined,
      pricingModel: data.pricingModel ? (data.pricingModel as PricingModel) : undefined,
      guests: Number(data.guests || 1),
      priceZar: Number(data.priceZar || 0),
      status: (data.status as BookingItem['status']) || 'Pending Verification',
      confirmedBy: data.confirmedBy ? String(data.confirmedBy) : undefined,
      cancellationReason: data.cancellationReason ? String(data.cancellationReason) : undefined,
      safetyVerified: true,
      accessible: Boolean(data.accessible),
      dataOrigin: 'live',
    };
  },

  subscribeUserBookings(uid: string, onData: (items: BookingItem[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.bookings;
    const q = query(collection(db, path), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => this.mapBookingDoc(d.id, d.data())));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  subscribeProviderBookings(providerId: string, onData: (items: BookingItem[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.bookings;
    const q = query(collection(db, path), where('providerId', '==', providerId));
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => this.mapBookingDoc(d.id, d.data())));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  subscribeAllBookingsAdmin(onData: (items: BookingItem[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.bookings;
    return onSnapshot(
      collection(db, path),
      (snap) => {
        onData(snap.docs.map((d) => this.mapBookingDoc(d.id, d.data())));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createBooking(uid: string, item: Omit<BookingItem, 'id' | 'status' | 'dataOrigin'>): Promise<void> {
    const path = FIREBASE_COLLECTIONS.bookings;
    try {
      await addDoc(collection(db, path), {
        userId: uid,
        providerId: item.providerId || uid,
        ...(item.offeringId ? { offeringId: clamp(item.offeringId, 128) } : {}),
        ...(item.offeringType ? { offeringType: item.offeringType } : {}),
        title: clamp(item.title, 160),
        providerName: clamp(item.providerName, 140),
        category: clamp(item.category, 80),
        ...(item.zone ? { zone: clamp(item.zone, 120) } : {}),
        date: clamp(item.date, 32),
        timeSlot: clamp(item.timeSlot, 32),
        ...(item.durationUnit ? { durationUnit: item.durationUnit } : {}),
        ...(typeof item.durationValue === 'number'
          ? { durationValue: Math.max(1, Math.min(60, Math.round(item.durationValue))) }
          : {}),
        ...(item.endDate ? { endDate: clamp(item.endDate, 32) } : {}),
        ...(item.endTime ? { endTime: clamp(item.endTime, 32) } : {}),
        ...(typeof item.unitPriceZar === 'number' ? { unitPriceZar: Math.max(0, Number(item.unitPriceZar)) } : {}),
        ...(item.pricingModel ? { pricingModel: item.pricingModel } : {}),
        guests: Math.max(1, Math.min(50, Math.round(item.guests))),
        priceZar: Math.max(0, Number(item.priceZar)),
        // Strict invariant: new bookings always start Pending Verification until confirmed by provider/admin
        status: 'Pending Verification',
        accessible: Boolean(item.accessible),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateBookingStatus(
    bookingId: string,
    status: BookingItem['status'],
    meta?: { confirmedBy?: string; cancellationReason?: string }
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.bookings}/${bookingId}`;
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (meta?.confirmedBy) payload.confirmedBy = clamp(meta.confirmedBy, 120);
    if (meta?.cancellationReason) payload.cancellationReason = clamp(meta.cancellationReason, 300);

    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.bookings, bookingId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- 4. Incidents & Advisories ---
  subscribeIncidents(onData: (items: SafetyAdvisory[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.incidents;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: SafetyAdvisory[] = snap.docs.map((d) => {
          const data = d.data();
          const hasConsentedCoords =
            data.locationConsent === true &&
            typeof data.sharedLat === 'number' &&
            typeof data.sharedLng === 'number';

          return {
            id: d.id,
            reporterId: String(data.reporterId || ''),
            category: data.category ? (data.category as IncidentCategory) : undefined,
            zone: String(data.zone || ''),
            severity: (data.severity as SafetyAdvisory['severity']) || 'Advisory',
            title: String(data.title || ''),
            summary: String(data.summary || ''),
            updatedAt: formatTimestamp(data.updatedAt),
            source: String(data.source || 'Safety Operations'),
            status: (data.status as SafetyAdvisory['status']) || 'Open',
            attachmentUrl: data.attachmentUrl ? String(data.attachmentUrl) : undefined,
            locationConsent: Boolean(data.locationConsent),
            sharedLat: hasConsentedCoords ? Number(data.sharedLat) : undefined,
            sharedLng: hasConsentedCoords ? Number(data.sharedLng) : undefined,
            locationLabel: data.locationLabel ? String(data.locationLabel) : undefined,
            assignedOfficerId: data.assignedOfficerId ? String(data.assignedOfficerId) : undefined,
            assignedOfficerName: data.assignedOfficerName ? String(data.assignedOfficerName) : undefined,
            resolutionNotes: data.resolutionNotes ? String(data.resolutionNotes) : undefined,
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createIncident(
    uid: string,
    advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.incidents;
    const allowCoords =
      advisory.locationConsent === true &&
      typeof advisory.sharedLat === 'number' &&
      typeof advisory.sharedLng === 'number';

    try {
      await addDoc(collection(db, path), {
        reporterId: uid,
        ...(advisory.category ? { category: advisory.category } : {}),
        zone: clamp(advisory.zone, 120),
        severity: advisory.severity,
        title: clamp(advisory.title, 160),
        summary: clamp(advisory.summary, 800),
        source: clamp(advisory.source, 140),
        status: 'Open',
        ...(advisory.attachmentUrl ? { attachmentUrl: clamp(advisory.attachmentUrl, 500) } : {}),
        locationConsent: Boolean(advisory.locationConsent),
        ...(allowCoords
          ? {
              sharedLat: advisory.sharedLat,
              sharedLng: advisory.sharedLng,
              ...(advisory.locationLabel ? { locationLabel: clamp(advisory.locationLabel, 160) } : {}),
            }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateIncidentStatusAndAssignment(
    incidentId: string,
    updates: {
      status?: SafetyAdvisory['status'];
      severity?: SafetyAdvisory['severity'];
      assignedOfficerId?: string;
      assignedOfficerName?: string;
      resolutionNotes?: string;
    }
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.incidents}/${incidentId}`;
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.status) payload.status = updates.status;
    if (updates.severity) payload.severity = updates.severity;
    if (updates.assignedOfficerId) payload.assignedOfficerId = clamp(updates.assignedOfficerId, 128);
    if (updates.assignedOfficerName) payload.assignedOfficerName = clamp(updates.assignedOfficerName, 100);
    if (updates.resolutionNotes !== undefined) {
      payload.resolutionNotes = clamp(updates.resolutionNotes, 400);
    }

    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.incidents, incidentId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async revokeIncidentLocation(incidentId: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.incidents}/${incidentId}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.incidents, incidentId), {
        locationConsent: false,
        sharedLat: deleteField(),
        sharedLng: deleteField(),
        locationLabel: deleteField(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- 5. Itineraries ---
  subscribeItineraries(uid: string, onData: (items: TripActivity[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.itineraries;
    const q = query(collection(db, path), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const items: TripActivity[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || ''),
            day: Number(data.day || 1),
            dayLabel: String(data.dayLabel || 'Day 1'),
            time: String(data.time || '09:00'),
            title: String(data.title || ''),
            zone: String(data.zone || ''),
            transportNote: String(data.transportNote || ''),
            safetyNote: String(data.safetyNote || ''),
            itemType: data.itemType ? (data.itemType as OfferingType) : undefined,
            bookingId: data.bookingId ? String(data.bookingId) : undefined,
            date: data.date ? String(data.date) : undefined,
            endDate: data.endDate ? String(data.endDate) : undefined,
            endTime: data.endTime ? String(data.endTime) : undefined,
            completed: Boolean(data.completed),
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async addItineraryItem(
    uid: string,
    item: Omit<TripActivity, 'id' | 'completed' | 'dataOrigin'>
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.itineraries;
    try {
      await addDoc(collection(db, path), {
        userId: uid,
        day: Math.max(1, Math.min(30, Math.round(item.day))),
        dayLabel: clamp(item.dayLabel, 120),
        time: clamp(item.time, 32),
        title: clamp(item.title, 160),
        zone: clamp(item.zone, 100),
        transportNote: clamp(item.transportNote, 200),
        safetyNote: clamp(item.safetyNote, 200),
        ...(item.itemType ? { itemType: item.itemType } : {}),
        ...(item.bookingId ? { bookingId: clamp(item.bookingId, 128) } : {}),
        ...(item.date ? { date: clamp(item.date, 32) } : {}),
        ...(item.endDate ? { endDate: clamp(item.endDate, 32) } : {}),
        ...(item.endTime ? { endTime: clamp(item.endTime, 32) } : {}),
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async toggleItineraryItem(id: string, completed: boolean): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.itineraries}/${id}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.itineraries, id), {
        completed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteItineraryItem(id: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.itineraries}/${id}`;
    try {
      await deleteDoc(doc(db, FIREBASE_COLLECTIONS.itineraries, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- 6. Notifications ---
  subscribeNotifications(uid: string, onData: (items: NotificationItem[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.notifications;
    const q = query(collection(db, path), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const items: NotificationItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || ''),
            title: String(data.title || ''),
            detail: String(data.detail || ''),
            category: (data.category as NotificationItem['category']) || 'System',
            timestamp: formatTimestamp(data.createdAt),
            read: Boolean(data.read),
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async markNotificationRead(id: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.notifications}/${id}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.notifications, id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async createNotification(
    uid: string,
    item: Omit<NotificationItem, 'id' | 'timestamp' | 'read' | 'dataOrigin'>
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.notifications;
    try {
      await addDoc(collection(db, path), {
        userId: uid,
        title: clamp(item.title, 160),
        detail: clamp(item.detail, 500),
        category: item.category,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // --- 7. Reviews ---
  subscribeReviews(onData: (items: ReviewItem[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.reviews;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: ReviewItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || ''),
            targetId: String(data.targetId || ''),
            rating: Number(data.rating || 5),
            comment: String(data.comment || ''),
            createdAtLabel: formatTimestamp(data.createdAt),
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async addReview(
    uid: string,
    authorName: string,
    targetId: string,
    rating: number,
    comment: string
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.reviews;
    try {
      await addDoc(collection(db, path), {
        authorId: uid,
        authorName: clamp(authorName, 100),
        targetId: clamp(targetId, 128),
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        comment: clamp(comment, 600),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // --- 8. Community Posts & Moderation ---
  subscribeCommunityPosts(onData: (items: CommunityPost[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.communityPosts;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: CommunityPost[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorId: String(data.authorId || ''),
            author: String(data.authorName || 'Traveler'),
            roleLabel: String(data.roleLabel || 'Tourist Explorer'),
            zone: String(data.zone || 'Cape Town'),
            timestamp: formatTimestamp(data.createdAt),
            content: String(data.content || ''),
            verifiedGuide: Boolean(data.verifiedGuide),
            moderationStatus: (data.moderationStatus as ModerationStatus) || 'Approved',
            flaggedBy: data.flaggedBy ? String(data.flaggedBy) : undefined,
            flagReason: data.flagReason ? String(data.flagReason) : undefined,
            moderatedBy: data.moderatedBy ? String(data.moderatedBy) : undefined,
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createCommunityPost(
    uid: string,
    post: Omit<CommunityPost, 'id' | 'timestamp' | 'dataOrigin'>
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.communityPosts;
    const initialStatus: ModerationStatus =
      post.moderationStatus === 'Under Review' ? 'Under Review' : 'Approved';
    try {
      await addDoc(collection(db, path), {
        authorId: uid,
        authorName: clamp(post.author, 100),
        roleLabel: clamp(post.roleLabel, 80),
        zone: clamp(post.zone, 100),
        content: clamp(post.content, 800),
        verifiedGuide: false,
        moderationStatus: initialStatus,
        ...(post.flagReason ? { flagReason: clamp(post.flagReason, 240) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async flagCommunityPost(postId: string, uid: string, reason: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.communityPosts}/${postId}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.communityPosts, postId), {
        moderationStatus: 'Under Review',
        flaggedBy: uid,
        flagReason: clamp(reason, 240),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async moderateCommunityPost(
    postId: string,
    moderatorUid: string,
    moderationStatus: ModerationStatus,
    options?: { verifiedGuide?: boolean; flagReason?: string }
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.communityPosts}/${postId}`;
    const payload: Record<string, unknown> = {
      moderationStatus,
      moderatedBy: moderatorUid,
      updatedAt: serverTimestamp(),
    };
    if (typeof options?.verifiedGuide === 'boolean') {
      payload.verifiedGuide = options.verifiedGuide;
    }
    if (options?.flagReason !== undefined) {
      payload.flagReason = clamp(options.flagReason, 240);
    }
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.communityPosts, postId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteCommunityPost(postId: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.communityPosts}/${postId}`;
    try {
      await deleteDoc(doc(db, FIREBASE_COLLECTIONS.communityPosts, postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- 8b. Challenge Progress & Badges Subcollection ---
  subscribeChallengeProgress(
    uid: string,
    onData: (progressMap: Record<string, { progress: number; completed: boolean; badgeTitle?: string }>) => void
  ): Unsubscribe {
    const path = `${FIREBASE_COLLECTIONS.users}/${uid}/challenge_progress`;
    return onSnapshot(
      collection(db, FIREBASE_COLLECTIONS.users, uid, 'challenge_progress'),
      (snap) => {
        const result: Record<string, { progress: number; completed: boolean; badgeTitle?: string }> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          result[d.id] = {
            progress: Number(data.progress || 0),
            completed: Boolean(data.completed),
            badgeTitle: data.badgeTitle ? String(data.badgeTitle) : undefined,
          };
        });
        onData(result);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async upsertChallengeProgress(uid: string, challenge: ChallengeItem): Promise<void> {
    const ref = doc(db, FIREBASE_COLLECTIONS.users, uid, 'challenge_progress', challenge.id);
    const path = `${FIREBASE_COLLECTIONS.users}/${uid}/challenge_progress/${challenge.id}`;
    const clampedProgress = Math.max(0, Math.min(100, Math.round(challenge.progress)));
    const clampedTarget = Math.max(1, Math.min(100, Math.round(challenge.target)));
    const completed = clampedProgress >= clampedTarget;

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          id: challenge.id,
          uid,
          title: clamp(challenge.title, 120),
          progress: clampedProgress,
          target: clampedTarget,
          completed,
          ...(challenge.badgeTitle ? { badgeTitle: clamp(challenge.badgeTitle, 80) } : {}),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          progress: clampedProgress,
          completed,
          ...(challenge.badgeTitle ? { badgeTitle: clamp(challenge.badgeTitle, 80) } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // --- 9. Travel Budgets ---
  subscribeTravelBudgets(uid: string, onData: (items: BudgetExpense[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.travelBudgets;
    const q = query(collection(db, path), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const items: BudgetExpense[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || ''),
            date: String(data.date || ''),
            description: String(data.description || ''),
            category: (data.category as BudgetExpense['category']) || 'Dining',
            amountZar: Number(data.amountZar || 0),
            paymentMethod: String(data.paymentMethod || 'Card'),
            bookingId: data.bookingId ? String(data.bookingId) : undefined,
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async addBudgetExpense(
    uid: string,
    expense: Omit<BudgetExpense, 'id' | 'dataOrigin'>
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.travelBudgets;
    try {
      await addDoc(collection(db, path), {
        userId: uid,
        date: clamp(expense.date, 32),
        description: clamp(expense.description, 160),
        category: expense.category,
        amountZar: Math.max(1, Number(expense.amountZar)),
        paymentMethod: clamp(expense.paymentMethod, 60),
        ...(expense.bookingId ? { bookingId: clamp(expense.bookingId, 128) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteBudgetExpense(id: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.travelBudgets}/${id}`;
    try {
      await deleteDoc(doc(db, FIREBASE_COLLECTIONS.travelBudgets, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- 10. Tourist Check-Ins & Trusted Contacts ---
  subscribeUserCheckIns(uid: string, onData: (items: CheckInSession[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.touristCheckIns;
    const q = query(collection(db, path), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const items: CheckInSession[] = snap.docs.map((d) => {
          const data = d.data();
          const hasConsentedCoords =
            data.locationConsent === true &&
            typeof data.sharedLat === 'number' &&
            typeof data.sharedLng === 'number';

          return {
            id: d.id,
            userId: String(data.userId || ''),
            touristName: String(data.touristName || ''),
            route: String(data.route || ''),
            startedAt: String(data.startedAt || ''),
            expectedReturn: String(data.expectedReturn || ''),
            expectedReturnIso: data.expectedReturnIso ? String(data.expectedReturnIso) : undefined,
            reminderMinutes: typeof data.reminderMinutes === 'number' ? data.reminderMinutes : undefined,
            reminderSent: Boolean(data.reminderSent),
            status: (data.status as CheckInSession['status']) || 'Active',
            emergencyContact: String(data.emergencyContact || ''),
            trustedContactsSummary: data.trustedContactsSummary
              ? String(data.trustedContactsSummary)
              : undefined,
            partySize: Number(data.partySize || 1),
            locationConsent: Boolean(data.locationConsent),
            sharedLat: hasConsentedCoords ? Number(data.sharedLat) : undefined,
            sharedLng: hasConsentedCoords ? Number(data.sharedLng) : undefined,
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createCheckIn(
    uid: string,
    session: Omit<CheckInSession, 'id' | 'dataOrigin'>
  ): Promise<void> {
    const path = FIREBASE_COLLECTIONS.touristCheckIns;
    if (!auth.currentUser) return;
    const allowCoords =
      session.locationConsent === true &&
      typeof session.sharedLat === 'number' &&
      typeof session.sharedLng === 'number';

    try {
      await addDoc(collection(db, path), {
        userId: uid,
        touristName: clamp(session.touristName, 100),
        route: clamp(session.route, 160),
        startedAt: clamp(session.startedAt, 40),
        expectedReturn: clamp(session.expectedReturn, 40),
        ...(session.expectedReturnIso
          ? { expectedReturnIso: clamp(session.expectedReturnIso, 40) }
          : {}),
        ...(typeof session.reminderMinutes === 'number'
          ? { reminderMinutes: Math.max(5, Math.min(240, Math.round(session.reminderMinutes))) }
          : {}),
        reminderSent: Boolean(session.reminderSent),
        status: 'Active',
        emergencyContact: clamp(session.emergencyContact, 140),
        ...(session.trustedContactsSummary
          ? { trustedContactsSummary: clamp(session.trustedContactsSummary, 300) }
          : {}),
        partySize: Math.max(1, Math.min(50, Math.round(session.partySize))),
        locationConsent: Boolean(session.locationConsent),
        ...(allowCoords
          ? {
              sharedLat: session.sharedLat,
              sharedLng: session.sharedLng,
            }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async extendCheckIn(
    id: string,
    expectedReturn: string,
    expectedReturnIso?: string
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.touristCheckIns}/${id}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.touristCheckIns, id), {
        expectedReturn: clamp(expectedReturn, 40),
        ...(expectedReturnIso ? { expectedReturnIso: clamp(expectedReturnIso, 40) } : {}),
        reminderSent: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async markCheckInReminderSent(id: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.touristCheckIns}/${id}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.touristCheckIns, id), {
        reminderSent: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async completeCheckIn(id: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.touristCheckIns}/${id}`;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.touristCheckIns, id), {
        status: 'Completed',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeTrustedContacts(uid: string, onData: (items: TrustedContact[]) => void): Unsubscribe {
    const path = `${FIREBASE_COLLECTIONS.users}/${uid}/trusted_contacts`;
    return onSnapshot(
      collection(db, FIREBASE_COLLECTIONS.users, uid, 'trusted_contacts'),
      (snap) => {
        const items: TrustedContact[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || uid),
            name: String(data.name || ''),
            relationship: String(data.relationship || 'Contact'),
            phone: String(data.phone || ''),
            email: data.email ? String(data.email) : undefined,
            notifyByDefault: Boolean(data.notifyByDefault),
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async addTrustedContact(
    uid: string,
    contact: Omit<TrustedContact, 'id' | 'uid' | 'dataOrigin'>
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.users}/${uid}/trusted_contacts`;
    try {
      await addDoc(collection(db, FIREBASE_COLLECTIONS.users, uid, 'trusted_contacts'), {
        uid,
        name: clamp(contact.name, 100),
        relationship: clamp(contact.relationship, 60),
        phone: clamp(contact.phone, 40),
        ...(contact.email ? { email: clamp(contact.email, 160) } : {}),
        notifyByDefault: Boolean(contact.notifyByDefault),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteTrustedContact(uid: string, contactId: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.users}/${uid}/trusted_contacts/${contactId}`;
    try {
      await deleteDoc(doc(db, FIREBASE_COLLECTIONS.users, uid, 'trusted_contacts', contactId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- 11. Destination Announcements ---
  subscribeAnnouncements(onData: (items: DestinationAnnouncement[]) => void): Unsubscribe {
    const path = FIREBASE_COLLECTIONS.announcements;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: DestinationAnnouncement[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || 'Operations'),
            title: String(data.title || ''),
            category: (data.category as AnnouncementCategory) || 'Visitor Advisory',
            zone: String(data.zone || 'Cape Town'),
            body: String(data.body || ''),
            priority: (data.priority as DestinationAnnouncement['priority']) || 'Info',
            pinned: Boolean(data.pinned),
            active: data.active !== false,
            updatedAtLabel: formatTimestamp(data.updatedAt),
            dataOrigin: 'live',
          };
        });
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, path)
    );
  },

  async createAnnouncement(
    uid: string,
    authorName: string,
    payload: {
      title: string;
      category: AnnouncementCategory;
      zone: string;
      body: string;
      priority: DestinationAnnouncement['priority'];
      pinned: boolean;
    }
  ): Promise<void> {
    const ref = doc(collection(db, FIREBASE_COLLECTIONS.announcements));
    const path = `${FIREBASE_COLLECTIONS.announcements}/${ref.id}`;
    try {
      await setDoc(ref, {
        id: ref.id,
        authorId: uid,
        authorName: clamp(authorName, 100),
        title: clamp(payload.title, 160),
        category: payload.category,
        zone: clamp(payload.zone, 120),
        body: clamp(payload.body, 1000),
        priority: payload.priority,
        pinned: Boolean(payload.pinned),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateAnnouncement(
    id: string,
    updates: Partial<Pick<DestinationAnnouncement, 'pinned' | 'active' | 'priority' | 'title' | 'body'>>
  ): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.announcements}/${id}`;
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (typeof updates.pinned === 'boolean') payload.pinned = updates.pinned;
    if (typeof updates.active === 'boolean') payload.active = updates.active;
    if (updates.priority) payload.priority = updates.priority;
    if (updates.title) payload.title = clamp(updates.title, 160);
    if (updates.body) payload.body = clamp(updates.body, 1000);

    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.announcements, id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const path = `${FIREBASE_COLLECTIONS.announcements}/${id}`;
    try {
      await deleteDoc(doc(db, FIREBASE_COLLECTIONS.announcements, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },
};
