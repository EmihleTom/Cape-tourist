import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROLE_LABELS } from './src/data/navigation.ts';
import type { UserRole } from './src/types/app.ts';

/**
 * Security Rule & RBAC Flow Verification Suite
 * Validates firestore.rules structure against the "Dirty Dozen" invariants
 * and tests role-based dashboard routing across all 4 CapeSafe roles.
 */
const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

// 1. Verify all 12 required collections + subcollections exist in both blueprint and firestore.rules
const requiredCollections = [
  'users',
  'tourism_businesses',
  'bookings',
  'incidents',
  'itineraries',
  'notifications',
  'reviews',
  'community_posts',
  'travel_budgets',
  'tourist_check_ins',
  'announcements',
  'provider_offerings',
];

for (const col of requiredCollections) {
  assert.ok(
    rulesContent.includes(`match /${col}/`),
    `Missing firestore.rules match block for collection: ${col}`
  );
  assert.ok(
    Object.keys(blueprint.firestore).some((k) => k.startsWith(`/${col}/`)),
    `Missing blueprint schema for collection: ${col}`
  );
}

assert.ok(
  Object.keys(blueprint.firestore).some((k) => k.includes('users/{userId}/private')),
  'Missing PII split private subcollection in firebase-blueprint.json'
);
assert.ok(
  Object.keys(blueprint.firestore).some((k) => k.includes('users/{userId}/trusted_contacts')),
  'Missing trusted_contacts subcollection in firebase-blueprint.json'
);
assert.ok(
  rulesContent.includes('match /trusted_contacts/{contactId}'),
  'Missing firestore.rules match block for trusted_contacts subcollection'
);

// 2. Verify Eight Pillars & Dirty Dozen rule assertions
assert.ok(
  rulesContent.includes('match /{document=**} {\n      allow read, write: if false;'),
  'Global default-deny catch-all rule missing'
);
assert.ok(
  rulesContent.includes('request.auth.token.email_verified == true'),
  'Email verification check missing (Email Spoofing test)'
);
assert.ok(
  rulesContent.includes("incoming().role == 'tourist'"),
  'Self-assigned role prevention missing on user creation'
);
assert.ok(
  rulesContent.includes('affectedKeys().hasOnly('),
  'Strict update field allowlisting missing (Shadow Update test)'
);
assert.ok(
  rulesContent.includes('incoming().createdAt == request.time'),
  'Server timestamp enforcement missing on create'
);
assert.ok(
  rulesContent.includes('incoming().updatedAt == request.time'),
  'Server timestamp enforcement missing on update'
);
assert.ok(
  rulesContent.includes("matches('^[a-zA-Z0-9_\\\\-]+$')"),
  'Document ID poisoning regex guard missing'
);

// 3. Verify Explicit Location Consent Invariant, Incident Management & Check-In Reminders
assert.ok(
  rulesContent.includes("data.locationConsent == true && 'sharedLat' in data && 'sharedLng' in data"),
  'Explicit location consent invariant missing in firestore.rules'
);
assert.ok(
  rulesContent.includes("'assignedOfficerId'") &&
    rulesContent.includes("'assignedOfficerName'") &&
    rulesContent.includes("'resolutionNotes'"),
  'Incident assignment and resolution fields missing in firestore.rules'
);
assert.ok(
  rulesContent.includes("'expectedReturnIso'") &&
    rulesContent.includes("'reminderMinutes'") &&
    rulesContent.includes("'reminderSent'"),
  'Check-in reminder & extension fields missing in firestore.rules'
);

// 4. Verify Booking Confirmation & Provider Offering Availability Rules
assert.ok(
  rulesContent.includes("incoming().status == 'Pending Verification'") &&
    rulesContent.includes("incoming().status == 'Cancelled'") &&
    rulesContent.includes("'confirmedBy'") &&
    rulesContent.includes("'cancellationReason'"),
  'Booking strict Pending Verification create and tourist-cancellation-only rules missing in firestore.rules'
);
assert.ok(
  rulesContent.includes('function isValidProviderOffering(data)') &&
    rulesContent.includes('isServiceProvider()') &&
    rulesContent.includes("'blockedDates'"),
  'Provider offering validation or availability rules missing in firestore.rules'
);

// 5. Verify Community Moderation, User Privacy Controls & Challenge Progress Subcollection Rules
assert.ok(
  Object.keys(blueprint.firestore).some((k) => k.includes('users/{userId}/challenge_progress')),
  'Missing challenge_progress subcollection in firebase-blueprint.json'
);
assert.ok(
  rulesContent.includes('match /challenge_progress/{challengeId}') &&
    rulesContent.includes('function isValidChallengeProgress(data)'),
  'Missing challenge_progress match block or validator in firestore.rules'
);
assert.ok(
  rulesContent.includes("'profileVisibility'") &&
    rulesContent.includes("'shareLocationConsent'") &&
    rulesContent.includes("'aiContextPersonalization'") &&
    rulesContent.includes("'preferredLanguage'"),
  'Missing user privacy & AI personalization controls in firestore.rules'
);
assert.ok(
  rulesContent.includes("incoming().moderationStatus in ['Approved', 'Under Review']") &&
    rulesContent.includes("incoming().flaggedBy == request.auth.uid") &&
    rulesContent.includes("'moderatedBy'"),
  'Missing community moderation and flagging rules in firestore.rules'
);

// 6. Verify all 4 User Roles map to distinct role dashboards
const roles: UserRole[] = ['tourist', 'admin', 'provider', 'safety'];
const titles = new Set(roles.map((r) => ROLE_LABELS[r].dashboardTitle));
assert.equal(titles.size, 4, 'Each of the 4 roles must map to a unique dashboard');

console.log(
  'PASSED: All 12 Firestore collections, trusted_contacts & challenge_progress subcollections, privacy controls, community moderation, location consent, booking confirmation & offering availability invariants, and 4 RBAC role mappings verified.'
);

