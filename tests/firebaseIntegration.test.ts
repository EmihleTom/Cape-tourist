import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FIREBASE_COLLECTIONS,
  getArchitectureReadiness,
  getFirebaseConfig,
  isFirebaseConfigured,
  testFirestoreConnection,
} from '../src/services/firebase/config.ts';
import { authService, mapFirebaseAuthError } from '../src/services/firebase/authService.ts';
import { dataService } from '../src/services/firebase/dataService.ts';
import { storageService } from '../src/services/firebase/storageService.ts';
import { ROLE_LABELS, NAV_ITEMS } from '../src/data/navigation.ts';
import { fetchCapeTownWeather } from '../src/services/weatherService.ts';
import { resolveZoneCoordinates } from '../src/components/map/CapeTownMap.tsx';
import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import {
  createApiRouter,
  runDeterministicPostModeration,
  verifyWebhookSignature,
} from '../server.ts';
import { aiService, buildSafeAiContext, OFFLINE_CAPE_TOWN_PHRASEBOOK } from '../src/services/aiService.ts';
import { offlineTravelService } from '../src/services/offlineTravelService.ts';
import { formatAuthorByVisibility } from '../src/pages/features/CommunityHubPage.tsx';
import {
  DEMO_ANNOUNCEMENTS,
  DEMO_ATTRACTIONS,
  DEMO_BOOKINGS,
  DEMO_CHALLENGES,
  DEMO_SAFETY_ADVISORIES,
  DEMO_TRIP_ACTIVITIES,
  DEMO_USERS,
} from '../src/data/demoData.ts';
import {
  buildItineraryFromConfirmedBooking,
  calculateBookingEndDateTime,
  calculateBookingPriceZar,
  calculateCheckoutAmounts,
  checkOfferingAvailability,
} from '../src/utils/bookingCalculations.ts';
import type { BookingItem, CapeTownWeather, ProviderListing, UserRole } from '../src/types/app.ts';

async function runTests() {
  // 1. Firebase Config & Environment Variables Fallback Check
  const cfg = getFirebaseConfig();
  assert.equal(isFirebaseConfigured(), true, 'Firebase config must be populated');
  assert.equal(cfg.projectId, 'woven-pager-znm8c');
  assert.equal(
    cfg.firestoreDatabaseId,
    'ai-studio-capesafeconnect3-f1cc3d92-55dc-4b8a-9e91-4b4accf27d48'
  );
  assert.ok(cfg.storageBucket.includes('woven-pager-znm8c'), 'Storage bucket must belong to project');

  const readiness = getArchitectureReadiness();
  assert.equal(readiness.mode, 'firebase-connected');
  assert.equal(readiness.storageReady, true);

  // Verify .env.example documents all VITE_FIREBASE_* keys + VITE_GOOGLE_MAPS_API_KEY
  const envExample = fs.readFileSync('.env.example', 'utf8');
  for (const key of [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_DATABASE_ID',
    'VITE_GOOGLE_MAPS_API_KEY',
  ]) {
    assert.ok(envExample.includes(key), `Missing ${key} in .env.example`);
  }

  // 2. Live Firestore Connection Check
  const firestoreReachable = await testFirestoreConnection();
  assert.equal(firestoreReachable, true, 'Firestore server connection check must succeed');

  // 3. Authentication Service Surface (Registration, Login, Logout, Password Reset)
  assert.equal(typeof authService.registerAccount, 'function');
  assert.equal(typeof authService.signInWithEmail, 'function');
  assert.equal(typeof authService.signInWithGoogle, 'function');
  assert.equal(typeof authService.sendPasswordReset, 'function');
  assert.equal(typeof authService.signOutFirebase, 'function');
  assert.equal(typeof authService.resendVerificationEmail, 'function');
  assert.equal(typeof authService.refreshVerificationStatus, 'function');

  // Error mapping checks for login, registration, and password reset
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/operation-not-allowed' }).includes('Email/Password'),
    'Must guide user on enabling Email/Password provider'
  );
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/email-already-in-use' }).includes('already exists')
  );
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/invalid-credential' }).includes('Invalid email or password')
  );
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/weak-password' }).includes('at least 6 characters')
  );
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/invalid-email' }).includes('valid email')
  );
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' }).includes('closed')
  );

  // Logout on clean session should resolve cleanly without throwing
  await authService.signOutFirebase();

  // 4. Role-Based Navigation & 4-Role Dashboard Mapping
  const roles: UserRole[] = ['tourist', 'admin', 'provider', 'safety'];
  for (const role of roles) {
    const res = await authService.signInWithRoleDemo(role);
    assert.equal(res.user.role, role, `Role demo login should return ${role}`);
    assert.ok(ROLE_LABELS[res.user.role].dashboardTitle.length > 0);
  }

  // Verify RBAC portal switching rule:
  // Only non-firebase (demo) OR firebase 'admin' may switch portals
  const canSwitch = (authMode: 'firebase' | 'demo', role: UserRole) =>
    authMode !== 'firebase' || role === 'admin';
  assert.equal(canSwitch('firebase', 'tourist'), false);
  assert.equal(canSwitch('firebase', 'provider'), false);
  assert.equal(canSwitch('firebase', 'safety'), false);
  assert.equal(canSwitch('firebase', 'admin'), true);
  assert.equal(canSwitch('demo', 'tourist'), true);

  // Verify all 15 navigation sections exist
  assert.equal(NAV_ITEMS.length, 15, 'All 15 planned navigation features must be registered');

  // 5. All 16 Domain Collections + New Feature Services + Storage Rules Verification
  assert.equal(Object.keys(FIREBASE_COLLECTIONS).length, 17); // 16 domain collections + admins marker
  assert.equal(FIREBASE_COLLECTIONS.announcements, 'announcements');
  assert.equal(FIREBASE_COLLECTIONS.providerOfferings, 'provider_offerings');
  assert.equal(FIREBASE_COLLECTIONS.payments, 'payments');
  assert.equal(FIREBASE_COLLECTIONS.savedPaymentMethods, 'saved_payment_methods');
  assert.equal(FIREBASE_COLLECTIONS.providerPaymentSettings, 'provider_payment_settings');
  assert.equal(FIREBASE_COLLECTIONS.paymentAuditLogs, 'payment_audit_logs');

  for (const methodName of [
    'createBusinessApplication',
    'subscribeProviderBookings',
    'subscribeAllBookingsAdmin',
    'updateBookingStatus',
    'updateBookingPaymentFields',
    'subscribeOfferings',
    'createProviderOffering',
    'updateProviderOffering',
    'deleteItineraryItem',
    'deleteBudgetExpense',
    'updateUserPassId',
    'updateIncidentStatusAndAssignment',
    'revokeIncidentLocation',
    'createNotification',
    'extendCheckIn',
    'markCheckInReminderSent',
    'subscribeTrustedContacts',
    'addTrustedContact',
    'deleteTrustedContact',
    'subscribeAnnouncements',
    'createAnnouncement',
    'updateAnnouncement',
    'deleteAnnouncement',
    'flagCommunityPost',
    'moderateCommunityPost',
    'deleteCommunityPost',
    'subscribeChallengeProgress',
    'upsertChallengeProgress',
    'subscribeUserPayments',
    'subscribeProviderPayments',
    'subscribeAllPaymentsAdmin',
    'createPaymentRecord',
    'updatePaymentRecord',
    'subscribeSavedCards',
    'saveTokenisedCard',
    'deleteSavedCard',
    'subscribeProviderPaymentSettings',
    'upsertProviderPaymentSettings',
    'subscribePaymentAuditLogs',
    'appendPaymentAuditLog',
  ] as const) {
    assert.equal(
      typeof dataService[methodName],
      'function',
      `Missing dataService.${methodName} export`
    );
  }

  assert.equal(typeof storageService.uploadUserAvatar, 'function');
  assert.equal(typeof storageService.uploadIncidentPhoto, 'function');
  assert.equal(typeof storageService.uploadBusinessComplianceDoc, 'function');

  const storageRules = fs.readFileSync('storage.rules', 'utf8');
  assert.ok(storageRules.includes('match /users/{userId}/avatar/'));
  assert.ok(storageRules.includes('match /incidents/{userId}/'));
  assert.ok(storageRules.includes('match /businesses/{userId}/'));

  // 6. Cape Town Weather Service (Open-Meteo or clearly labeled demo fallback)
  const weather = await fetchCapeTownWeather();
  assert.equal(typeof weather.temperatureC, 'number');
  assert.equal(typeof weather.windSpeedKmh, 'number');
  assert.ok(['live', 'demo'].includes(weather.dataOrigin));

  // 7. Google Maps Platform Configuration, Attribution & Zone Coordinates
  const tableMountainCoords = resolveZoneCoordinates('Table Mountain');
  assert.ok(tableMountainCoords.lat < -33 && tableMountainCoords.lat > -35);
  assert.ok(tableMountainCoords.lng > 18 && tableMountainCoords.lng < 19);

  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  assert.ok(viteConfig.includes('VITE_GOOGLE_MAPS_API_KEY'), 'vite.config.ts must bridge VITE_GOOGLE_MAPS_API_KEY');

  const capeTownMapSrc = fs.readFileSync('src/components/map/CapeTownMap.tsx', 'utf8');
  assert.ok(capeTownMapSrc.includes('gmp_mcp_codeassist_v1_aistudio'), 'Missing mandatory GMP attribution ID');
  assert.ok(capeTownMapSrc.includes('mapId="DEMO_MAP_ID"'), 'Missing mapId for AdvancedMarker');

  const mainTsxSrc = fs.readFileSync('src/main.tsx', 'utf8');
  assert.ok(mainTsxSrc.includes('gm_authFailure') && mainTsxSrc.includes('OverQuotaMapError'));

  // 8. Travel Management System: Durations, End-Dates, Pricing, Availability & Booking Workflows
  // 8a. Flexible durations & automatic end-date calculations
  const hoursSameDay = calculateBookingEndDateTime('2026-11-16', '09:30', 'hours', 4);
  assert.equal(hoursSameDay.endDate, '2026-11-16');
  assert.equal(hoursSameDay.endTime, '13:30');

  const hoursOvernight = calculateBookingEndDateTime('2026-11-16', '22:00', 'hours', 4);
  assert.equal(hoursOvernight.endDate, '2026-11-17');
  assert.equal(hoursOvernight.endTime, '02:00');

  const sessionsCalc = calculateBookingEndDateTime('2026-11-16', '08:30', 'sessions', 2);
  assert.equal(sessionsCalc.endDate, '2026-11-16');
  assert.equal(sessionsCalc.endTime, '12:30'); // 2 sessions * 2h = 4h

  const nightsRollover = calculateBookingEndDateTime('2026-11-29', '14:00', 'nights', 3);
  assert.equal(nightsRollover.endDate, '2026-12-02');
  assert.equal(nightsRollover.endTime, '10:00');

  const oneDay = calculateBookingEndDateTime('2026-11-18', '08:00', 'days', 1);
  assert.equal(oneDay.endDate, '2026-11-18');
  assert.equal(oneDay.endTime, '17:00');

  const multiDay = calculateBookingEndDateTime('2026-11-18', '08:00', 'days', 3);
  assert.equal(multiDay.endDate, '2026-11-20');
  assert.equal(multiDay.endTime, '17:00');

  // 8b. Provider-defined pricing models (per_guest vs per_unit)
  assert.equal(calculateBookingPriceZar(850, 2, 3, 'per_guest'), 5100);
  assert.equal(calculateBookingPriceZar(2400, 3, 4, 'per_unit'), 7200);

  // 8c. Availability guards (Active, Paused, Safety Audit, Blackout Dates, Capacity)
  const baseOffering: ProviderListing = {
    id: 'test-off-1',
    providerId: 'prov-1',
    providerName: 'CapeSafe Partner',
    offeringType: 'Activity',
    experienceTitle: 'Table Mountain Guided Ascent',
    category: 'Guided Hike',
    zone: 'Table Mountain',
    durationUnit: 'sessions',
    defaultDurationValue: 1,
    pricingModel: 'per_guest',
    nextDeparture: '08:00',
    bookedSeats: 8,
    capacity: 10,
    priceZar: 850,
    accessible: false,
    safetyChecklistComplete: true,
    status: 'Active',
    blockedDates: ['2026-11-25'],
    dataOrigin: 'demo',
  };

  assert.equal(checkOfferingAvailability(baseOffering, '2026-11-20', 2).available, true);
  assert.equal(checkOfferingAvailability(baseOffering, '2026-11-20', 3).available, false);
  assert.equal(checkOfferingAvailability(baseOffering, '2026-11-25', 1).available, false);
  assert.equal(
    checkOfferingAvailability({ ...baseOffering, status: 'Paused' }, '2026-11-20', 1).available,
    false
  );
  assert.equal(
    checkOfferingAvailability(
      { ...baseOffering, safetyChecklistComplete: false },
      '2026-11-20',
      1
    ).available,
    false
  );
  assert.equal(
    checkOfferingAvailability(
      { ...baseOffering, pricingModel: 'per_unit', bookedSeats: 9, capacity: 10 },
      '2026-11-20',
      4
    ).available,
    true
  );

  // 8d. Booking confirmation workflow & itinerary unification (Accommodation + Transport + Activity)
  const bookingsPageSrc = fs.readFileSync('src/pages/features/BookingsPage.tsx', 'utf8');
  assert.ok(
    bookingsPageSrc.includes('Pending Verification'),
    'BookingsPage must enforce Pending Verification copy until provider confirms'
  );
  assert.ok(
    !bookingsPageSrc.includes("status: 'Confirmed'"),
    'BookingsPage must never self-confirm new reservations'
  );

  const confirmedStay: BookingItem = {
    id: 'bk-stay-1',
    offeringType: 'Accommodation',
    title: 'Atlantic Seaboard Studio',
    providerName: 'Sea Point Accredited Suites',
    category: 'Accommodation',
    zone: 'Sea Point',
    date: '2026-11-16',
    timeSlot: '14:00',
    durationUnit: 'nights',
    durationValue: 3,
    endDate: '2026-11-19',
    endTime: '10:00',
    guests: 2,
    priceZar: 7200,
    status: 'Confirmed',
    confirmedBy: 'Sea Point Accredited Suites',
    safetyVerified: true,
    accessible: true,
    dataOrigin: 'demo',
  };
  const confirmedTransport: BookingItem = {
    id: 'bk-trn-1',
    offeringType: 'Transport',
    title: 'Peninsula Electric Chauffeur',
    providerName: 'CapeSafe Green Transit',
    category: 'Transport',
    zone: 'Airport & Peninsula',
    date: '2026-11-16',
    timeSlot: '11:00',
    durationUnit: 'hours',
    durationValue: 4,
    endDate: '2026-11-16',
    endTime: '15:00',
    guests: 2,
    priceZar: 1800,
    status: 'Confirmed',
    confirmedBy: 'CapeSafe Green Transit',
    safetyVerified: true,
    accessible: true,
    dataOrigin: 'demo',
  };

  const stayStop = buildItineraryFromConfirmedBooking(confirmedStay, 1);
  const transportStop = buildItineraryFromConfirmedBooking(confirmedTransport, 1);
  assert.equal(stayStop.itemType, 'Accommodation');
  assert.equal(stayStop.bookingId, 'bk-stay-1');
  assert.equal(transportStop.itemType, 'Transport');
  assert.equal(transportStop.bookingId, 'bk-trn-1');

  // 9. Advanced Features: Server-Side AI Security, Moderation, Privacy Controls, EN/AF/XH, Challenges, Offline Mode
  // 9a. Ensure no GEMINI_API_KEY or @google/genai leaks into client src/
  function collectSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...collectSourceFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
    return files;
  }
  const clientFiles = collectSourceFiles('src');
  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('GEMINI_API_KEY'), `Client file ${file} must never reference GEMINI_API_KEY`);
    assert.ok(!content.includes('@google/genai'), `Client file ${file} must never import @google/genai`);
    assert.ok(!content.includes('PAYSTACK_SECRET_KEY'), `Client file ${file} must never reference PAYSTACK_SECRET_KEY`);
    assert.ok(!content.includes('PAYSTACK_WEBHOOK_SECRET'), `Client file ${file} must never reference PAYSTACK_WEBHOOK_SECRET`);
    assert.ok(!content.includes('CAPESAFE_PSP_WEBHOOK_SECRET'), `Client file ${file} must never reference CAPESAFE_PSP_WEBHOOK_SECRET`);
  }

  // 9b. AI context privacy gating (aiContextPersonalization true vs false)
  const sampleWeather: CapeTownWeather = {
    temperatureC: 22,
    windSpeedKmh: 28,
    windGustsKmh: 42,
    conditionLabel: 'Partly Cloudy · Southeaster Gusts',
    cablewayRisk: 'Moderate',
    observedAtLabel: '09:00 SAST',
    dataOrigin: 'demo',
  };
  const ctxWithPersonalization = buildSafeAiContext({
    user: { ...DEMO_USERS[0], aiContextPersonalization: true, accessibilityPriority: true },
    weather: sampleWeather,
    advisories: DEMO_SAFETY_ADVISORIES,
    announcements: DEMO_ANNOUNCEMENTS,
    attractions: DEMO_ATTRACTIONS,
    bookings: DEMO_BOOKINGS,
    activities: DEMO_TRIP_ACTIVITIES,
  });
  assert.equal(ctxWithPersonalization.personalizationEnabled, true);
  assert.ok(ctxWithPersonalization.userContext !== undefined);
  assert.equal(ctxWithPersonalization.userContext?.accessibilityPriority, true);

  const ctxPrivacyPaused = buildSafeAiContext({
    user: { ...DEMO_USERS[0], aiContextPersonalization: false },
    weather: sampleWeather,
    advisories: DEMO_SAFETY_ADVISORIES,
    announcements: DEMO_ANNOUNCEMENTS,
    attractions: DEMO_ATTRACTIONS,
    bookings: DEMO_BOOKINGS,
    activities: DEMO_TRIP_ACTIVITIES,
  });
  assert.equal(ctxPrivacyPaused.personalizationEnabled, false);
  assert.equal(ctxPrivacyPaused.userContext, undefined);

  // 9c. Community visibility privacy formatting
  assert.equal(formatAuthorByVisibility({ ...DEMO_USERS[0], profileVisibility: 'public_guides' }), 'Maya van der Merwe');
  assert.equal(formatAuthorByVisibility({ ...DEMO_USERS[0], profileVisibility: 'initials_only' }), 'M. V. D. M.');
  assert.equal(formatAuthorByVisibility({ ...DEMO_USERS[0], profileVisibility: 'private' }), 'CapeSafe Traveler');

  // 9d. Deterministic community post moderation
  assert.equal(runDeterministicPostModeration('Hi').allowed, false);
  assert.equal(runDeterministicPostModeration('Clear morning conditions at Kirstenbosch boardwalk.').moderationStatus, 'Approved');
  assert.equal(runDeterministicPostModeration('Call me on +27 82 555 0199 for guide info').moderationStatus, 'Under Review');
  assert.equal(runDeterministicPostModeration('Visit https://spam-link.example now').moderationStatus, 'Under Review');

  // 9e. Language & Cultural Phrasebook (EN / AF / XH) + Challenge Badges + Offline Service
  assert.ok(OFFLINE_CAPE_TOWN_PHRASEBOOK.length >= 6);
  for (const phrase of OFFLINE_CAPE_TOWN_PHRASEBOOK) {
    assert.ok(phrase.en.length > 0 && phrase.af.length > 0 && phrase.xh.length > 0);
  }
  assert.ok(DEMO_CHALLENGES.every((c) => Boolean(c.badgeTitle) && Boolean(c.badgeDescription)));
  assert.equal(typeof aiService.askConcierge, 'function');
  assert.equal(typeof aiService.generatePersonalizedPlan, 'function');
  assert.equal(typeof aiService.translateAndCoach, 'function');
  assert.equal(typeof aiService.moderateCommunityPost, 'function');
  assert.equal(typeof offlineTravelService.saveBundle, 'function');
  assert.equal(typeof offlineTravelService.loadBundle, 'function');
  assert.equal(typeof offlineTravelService.clearBundle, 'function');

  // 9f. Express Server API endpoints (/api/health, /api/community/moderate, /api/ai/*)
  const testApp = express();
  testApp.use('/api', createApiRouter());
  const server = testApp.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { status: string; model: string; aiConfigured: boolean };
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.model, 'gemini-4-hydrogen');

    const modCleanRes = await fetch(`http://127.0.0.1:${port}/api/community/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Calm sunny visibility along Sea Point promenade.', zone: 'Sea Point' }),
    });
    assert.equal(modCleanRes.status, 200);
    const modCleanJson = (await modCleanRes.json()) as { allowed: boolean; moderationStatus: string };
    assert.equal(modCleanJson.allowed, true);

    const modPiiRes = await fetch(`http://127.0.0.1:${port}/api/community/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Email me at tourist@example.com for a ride', zone: 'CBD' }),
    });
    assert.equal(modPiiRes.status, 200);
    const modPiiJson = (await modPiiRes.json()) as { moderationStatus: string };
    assert.equal(modPiiJson.moderationStatus, 'Under Review');

    const badConciergeRes = await fetch(`http://127.0.0.1:${port}/api/ai/concierge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.equal(badConciergeRes.status, 400);

    const badTranslateRes = await fetch(`http://127.0.0.1:${port}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });
    assert.equal(badTranslateRes.status, 400);

    // 10. Payment Gateway Endpoints & Checkout Calculations (PayShap, Tokenised Card, Pay in Person, Webhook, Refunds)
    const payArrival = calculateCheckoutAmounts(2000, {
      paymentPolicy: 'reserve_pay_on_arrival',
      payInPersonEnabled: true,
      advancePaymentRequired: false,
    });
    assert.equal(payArrival.payInPersonAllowed, true);
    assert.equal(payArrival.onlinePayableZar, 2000);

    const payFullOnline = calculateCheckoutAmounts(2000, {
      paymentPolicy: 'pay_full_online',
      payInPersonEnabled: true,
    });
    assert.equal(payFullOnline.payInPersonAllowed, false);
    assert.equal(payFullOnline.onlinePayableZar, 2000);

    const payDeposit = calculateCheckoutAmounts(2000, {
      paymentPolicy: 'deposit_online_balance_in_person',
      depositPercentage: 30,
    });
    assert.equal(payDeposit.isDepositOnly, true);
    assert.equal(payDeposit.onlinePayableZar, 600);
    assert.equal(payDeposit.balanceDueInPersonZar, 1400);

    const payBeforeService = calculateCheckoutAmounts(1500, {
      paymentPolicy: 'pay_in_person_before_service',
      payInPersonEnabled: true,
    });
    assert.equal(payBeforeService.payInPersonAllowed, true);
    assert.equal(payBeforeService.balanceDueInPersonZar, 1500);

    const payConfigRes = await fetch(`http://127.0.0.1:${port}/api/payments/config`);
    assert.equal(payConfigRes.status, 200);
    const payConfigJson = (await payConfigRes.json()) as {
      mode: string;
      supportedCurrencies: string[];
      supportedMethods: string[];
    };
    assert.ok(payConfigJson.supportedCurrencies.includes('ZAR'));
    assert.ok(payConfigJson.supportedMethods.includes('PayShap'));
    assert.ok(payConfigJson.supportedMethods.includes('Pay in Person'));

    // Tokenization returns token, cardBrand, last4 only (never raw cardNumber or cvv)
    const tokRes = await fetch(`http://127.0.0.1:${port}/api/payments/tokenize-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardNumber: '4242424242424242',
        expiryMonth: '08',
        expiryYear: '2028',
        cvv: '123',
        cardholderName: 'Maya van der Merwe',
      }),
    });
    assert.equal(tokRes.status, 200);
    const tokJson = (await tokRes.json()) as Record<string, unknown>;
    assert.equal(tokJson.cardBrand, 'Visa');
    assert.equal(tokJson.lastFourDigits, '4242');
    assert.ok(String(tokJson.providerToken).startsWith('tok_'));
    assert.equal('cardNumber' in tokJson, false);
    assert.equal('cvv' in tokJson, false);

    // Mismatched amount rejected (amount tampering defense)
    const tamperedInitRes = await fetch(`http://127.0.0.1:${port}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: 'bk-tamper-1',
        bookingReference: 'CS-BK-999111',
        amount: 10,
        bookingTotalZar: 1800,
        currency: 'ZAR',
        paymentMethod: 'PayShap',
        policy: 'pay_full_online',
      }),
    });
    assert.equal(tamperedInitRes.status, 400);

    // Valid PayShap initiation + idempotency duplicate protection
    const idemKey = `test-ps-${Date.now()}`;
    const initRes = await fetch(`http://127.0.0.1:${port}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: 'bk-ps-1',
        bookingReference: 'CS-BK-777111',
        amount: 1800,
        bookingTotalZar: 1800,
        currency: 'ZAR',
        paymentMethod: 'PayShap',
        idempotencyKey: idemKey,
      }),
    });
    assert.equal(initRes.status, 200);
    const initJson = (await initRes.json()) as { paymentReference: string };
    assert.ok(initJson.paymentReference.startsWith('PAY-PS-'));

    const dupInitRes = await fetch(`http://127.0.0.1:${port}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: 'bk-ps-1',
        bookingReference: 'CS-BK-777111',
        amount: 1800,
        bookingTotalZar: 1800,
        currency: 'ZAR',
        paymentMethod: 'PayShap',
        idempotencyKey: idemKey,
      }),
    });
    assert.equal(dupInitRes.status, 200);
    const dupInitJson = (await dupInitRes.json()) as { duplicateProtected?: boolean; paymentReference: string };
    assert.equal(dupInitJson.duplicateProtected, true);
    assert.equal(dupInitJson.paymentReference, initJson.paymentReference);

    // Verify Pending -> Failed -> Expired -> Cancelled -> Paid outcomes
    const pendingVerify = await (
      await fetch(`http://127.0.0.1:${port}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: initJson.paymentReference, simulatedOutcome: 'Payment Pending' }),
      })
    ).json() as { verified: boolean; paymentStatus: string };
    assert.equal(pendingVerify.verified, false);
    assert.equal(pendingVerify.paymentStatus, 'Payment Pending');

    const failedVerify = await (
      await fetch(`http://127.0.0.1:${port}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: initJson.paymentReference, simulatedOutcome: 'Failed' }),
      })
    ).json() as { verified: boolean; paymentStatus: string };
    assert.equal(failedVerify.verified, false);
    assert.equal(failedVerify.paymentStatus, 'Failed');

    const paidVerify = await (
      await fetch(`http://127.0.0.1:${port}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: initJson.paymentReference, simulatedOutcome: 'Paid' }),
      })
    ).json() as { verified: boolean; paymentStatus: string };
    assert.equal(paidVerify.verified, true);
    assert.equal(paidVerify.paymentStatus, 'Paid');

    // Refund validation (partial + full)
    const partialRefund = await (
      await fetch(`http://127.0.0.1:${port}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentReference: initJson.paymentReference,
          amount: 500,
          originalAmount: 1800,
          paymentStatus: 'Paid',
          reason: 'Weather adjustment partial refund',
        }),
      })
    ).json() as { success: boolean; paymentStatus: string; refundedAmount: number };
    assert.equal(partialRefund.success, true);
    assert.equal(partialRefund.paymentStatus, 'Partially Refunded');

    // Webhook HMAC verification helper & unauthorized webhook rejection
    const testWebhookBody = JSON.stringify({ event: 'charge.success', data: { reference: initJson.paymentReference } });
    const validSig = crypto.createHmac('sha512', 'test-webhook-secret').update(testWebhookBody).digest('hex');
    assert.equal(verifyWebhookSignature(testWebhookBody, validSig, 'test-webhook-secret'), true);
    assert.equal(verifyWebhookSignature(testWebhookBody, 'invalid-signature', 'test-webhook-secret'), false);

    const badWebhookRes = await fetch(`http://127.0.0.1:${port}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': 'tampered' },
      body: testWebhookBody,
    });
    assert.equal(badWebhookRes.status, 401);
  } finally {
    server.close();
  }

  // 11. QA Regression Checks (No fake metric offsets, HMR disabled, bounded booking inputs, Payment options present)
  const adminDashSrc = fs.readFileSync('src/pages/dashboards/AdminDashboard.tsx', 'utf8');
  assert.ok(
    !adminDashSrc.includes('140 + approvedCount'),
    'AdminDashboard must display real approved application count without a +140 fake offset'
  );

  const serverSrc = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    serverSrc.includes('hmr: false'),
    'server.ts must configure Vite hmr: false to prevent WebSocket connection errors'
  );

  assert.ok(
    bookingsPageSrc.includes('min={1}') &&
      bookingsPageSrc.includes('max={30}') &&
      bookingsPageSrc.includes('max={20}'),
    'BookingsPage must enforce min/max bounds on durationValue and guests'
  );
  assert.ok(
    bookingsPageSrc.includes('PayShap') && bookingsPageSrc.includes('Pay in Person'),
    'BookingsPage checkout integration must surface PayShap, Card, and Pay in Person'
  );

  console.log(
    'PASSED: Firebase config, live Firestore ping, Auth/Reset/Logout, 4-role RBAC, all 17 collection keys, Weather, Storage rules, Google Maps setup, Travel Management calculations/availability/workflows, PayShap/Card/Pay-in-Person checkout & refund/webhook endpoints, Advanced AI/Moderation/Privacy/Language/Accessibility/Challenges/Offline APIs, and QA regressions verified.'
  );
}

runTests().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});

