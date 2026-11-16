export type UserRole = 'tourist' | 'admin' | 'provider' | 'safety';

export type AuthView = 'landing' | 'login' | 'register' | 'app';

export type NavSectionId =
  | 'dashboard'
  | 'explore'
  | 'bookings'
  | 'trips'
  | 'safety'
  | 'check-in'
  | 'transport'
  | 'ai-assistant'
  | 'community'
  | 'budget'
  | 'pass'
  | 'accessibility'
  | 'challenges'
  | 'notifications'
  | 'settings';

export type DataOrigin = 'demo' | 'live';

export type PreferredLanguage = 'English' | 'Afrikaans' | 'isiXhosa';
export type ProfileVisibility = 'public_guides' | 'initials_only' | 'private';
export type ModerationStatus = 'Approved' | 'Under Review' | 'Removed';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  requestedRole?: UserRole;
  roleTitle: string;
  organization: string;
  location: string;
  avatarUrl?: string;
  passId?: string;
  emergencyContact?: string;
  accessibilityPriority?: boolean;
  profileVisibility?: ProfileVisibility;
  shareLocationConsent?: boolean;
  aiContextPersonalization?: boolean;
  preferredLanguage?: PreferredLanguage;
  emailVerified?: boolean;
  authMode?: 'firebase' | 'demo';
  dataOrigin: DataOrigin;
}

export type ActivityCategory =
  | 'Attractions and sightseeing'
  | 'Outdoor adventures'
  | 'Water activities'
  | 'Nature and wildlife'
  | 'Family entertainment'
  | 'Culture and heritage'
  | 'Food and culinary experiences'
  | 'Markets and shopping'
  | 'Art and creative experiences'
  | 'Guided tours'
  | 'Sports and recreation'
  | 'Day trips and excursions';

export interface DirectoryCategoryConfig {
  id: string;
  name: ActivityCategory;
  enabled: boolean;
  featured: boolean;
  description: string;
  dataOrigin: DataOrigin;
}

export interface FavouriteItem {
  id: string;
  userId: string;
  listingId: string;
  listingTitle: string;
  listingType: 'Attraction' | 'Activity' | 'Provider';
  precinct: string;
  createdAtLabel: string;
  dataOrigin: DataOrigin;
}

export interface AttractionItem {
  id: string;
  title: string;
  precinct: string;
  category: 'Coastal' | 'Mountain' | 'Heritage' | 'Accessibility';
  activityCategories?: ActivityCategory[];
  entryType?: 'Attraction' | 'Activity';
  featured?: boolean;
  popular?: boolean;
  recentlyAdded?: boolean;
  recommended?: boolean;
  familyFriendly?: boolean;
  accessible?: boolean;
  ageRequirement?: string;
  minAge?: number;
  groupSizeMax?: number;
  availableToday?: boolean;
  availableDates?: string[];
  durationUnit?: DurationUnit;
  defaultDurationValue?: number;
  pricingModel?: PricingModel;
  includedServices?: string[];
  whatToBring?: string[];
  cancellationPolicy?: string;
  safetyInfo?: string;
  nearbyTransport?: string[];
  galleryImages?: string[];
  providerId?: string;
  providerName?: string;
  verifiedProvider?: boolean;
  supportedPaymentMethods?: PaymentMethodType[];
  offeringId?: string;
  safetyStatus: 'Nominal' | 'Wind Advisory' | 'Guided Recommended';
  accessibilitySummary: string;
  duration: string;
  priceZar: number;
  imageUrl: string;
  description: string;
  coordinates: string;
  lat: number;
  lng: number;
  dataOrigin: DataOrigin;
}

export type DurationUnit = 'hours' | 'days' | 'nights' | 'sessions';
export type OfferingType = 'Accommodation' | 'Transport' | 'Activity';
export type PricingModel = 'per_guest' | 'per_unit';

export type BookingStatus =
  | 'Pending'
  | 'Pending Verification'
  | 'Awaiting Provider Confirmation'
  | 'Confirmed'
  | 'Rejected'
  | 'Completed'
  | 'Cancelled'
  | 'Available';

export type PaymentStatus =
  | 'Unpaid'
  | 'Payment Pending'
  | 'Processing'
  | 'Paid'
  | 'Failed'
  | 'Partially Paid'
  | 'Refunded'
  | 'Partially Refunded';

export type PaymentMethodType = 'PayShap' | 'Card' | 'Pay in Person';

export type InPersonPaymentMethod = 'Cash' | 'Card Machine' | 'EFT' | 'SnapScan' | 'Zapper';

export type ProviderPaymentPolicy =
  | 'reserve_pay_on_arrival'
  | 'pay_full_online'
  | 'deposit_online_balance_in_person'
  | 'pay_in_person_before_service';

export type PaymentDueTiming =
  | 'On Arrival'
  | 'Before Service Begins'
  | 'Upon Check-in'
  | 'Within 24 Hours Before Service';

export interface PaymentRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  userId: string;
  userName?: string;
  providerId: string;
  providerName: string;
  serviceTitle: string;
  amount: number;
  bookingTotalZar: number;
  depositAmount?: number;
  balanceDueInPerson?: number;
  refundedAmount?: number;
  currency: 'ZAR';
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentProviderReference?: string;
  providerVerified?: boolean;
  paymentMode?: 'live' | 'demo';
  inPersonMethodUsed?: InPersonPaymentMethod;
  inPersonConfirmedBy?: string;
  inPersonConfirmedAt?: string;
  savedCardTokenId?: string;
  cardBrand?: string;
  cardLastFour?: string;
  failureReason?: string;
  receiptNumber?: string;
  paidAtLabel?: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  dataOrigin: DataOrigin;
}

export interface SavedPaymentMethod {
  id: string;
  userId: string;
  providerToken: string;
  cardBrand: 'Visa' | 'Mastercard' | 'Amex' | 'Other';
  cardholderName: string;
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  paymentMode: 'live' | 'demo';
  createdAtLabel: string;
  dataOrigin: DataOrigin;
}

export interface ProviderPaymentSettings {
  id: string;
  providerId: string;
  providerName: string;
  payInPersonEnabled: boolean;
  acceptedInPersonMethods: InPersonPaymentMethod[];
  paymentInstructions: string;
  paymentLocation: string;
  paymentDueTiming: PaymentDueTiming;
  advancePaymentRequired: boolean;
  depositPercentage: number;
  paymentPolicy: ProviderPaymentPolicy;
  updatedAtLabel: string;
  dataOrigin: DataOrigin;
}

export interface PaymentAuditLog {
  id: string;
  paymentId: string;
  bookingId: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  previousStatus?: PaymentStatus;
  newStatus: PaymentStatus;
  amountZar: number;
  notes: string;
  timestampLabel: string;
  dataOrigin: DataOrigin;
}

export interface BookingItem {
  id: string;
  bookingReference?: string;
  userId?: string;
  providerId?: string;
  offeringId?: string;
  offeringType?: OfferingType;
  title: string;
  providerName: string;
  category: string;
  zone?: string;
  date: string;
  timeSlot: string;
  durationUnit?: DurationUnit;
  durationValue?: number;
  endDate?: string;
  endTime?: string;
  unitPriceZar?: number;
  pricingModel?: PricingModel;
  guests: number;
  priceZar: number;
  status: BookingStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethodType;
  paymentPolicy?: ProviderPaymentPolicy;
  depositAmountZar?: number;
  paidAmountZar?: number;
  balanceDueInPersonZar?: number;
  paymentId?: string;
  paymentReference?: string;
  confirmedBy?: string;
  cancellationReason?: string;
  safetyVerified: boolean;
  accessible: boolean;
  dataOrigin: DataOrigin;
}

export interface TripActivity {
  id: string;
  userId?: string;
  day: number;
  dayLabel: string;
  time: string;
  title: string;
  zone: string;
  transportNote: string;
  safetyNote: string;
  itemType?: OfferingType;
  bookingId?: string;
  date?: string;
  endDate?: string;
  endTime?: string;
  completed: boolean;
  dataOrigin: DataOrigin;
}

export type IncidentCategory =
  | 'Trail Hazard'
  | 'Coastal / Marine'
  | 'Transport & Transit'
  | 'Theft / Suspicious Activity'
  | 'Medical / Rescue'
  | 'Infrastructure / Lighting'
  | 'Safety Advisory';

export interface SafetyAdvisory {
  id: string;
  reporterId?: string;
  category?: IncidentCategory;
  zone: string;
  severity: 'Nominal' | 'Advisory' | 'Elevated';
  title: string;
  summary: string;
  updatedAt: string;
  source: string;
  status?: 'Open' | 'Acknowledged' | 'Resolved';
  attachmentUrl?: string;
  locationConsent?: boolean;
  sharedLat?: number;
  sharedLng?: number;
  locationLabel?: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  resolutionNotes?: string;
  dataOrigin: DataOrigin;
}

export interface CheckInSession {
  id: string;
  userId?: string;
  touristName: string;
  route: string;
  startedAt: string;
  expectedReturn: string;
  expectedReturnIso?: string;
  reminderMinutes?: number;
  reminderSent?: boolean;
  status: 'Active' | 'Overdue' | 'Completed';
  emergencyContact: string;
  trustedContactsSummary?: string;
  partySize: number;
  locationConsent?: boolean;
  sharedLat?: number;
  sharedLng?: number;
  dataOrigin: DataOrigin;
}

export interface TrustedContact {
  id: string;
  uid?: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  notifyByDefault: boolean;
  dataOrigin: DataOrigin;
}

export interface TransportRoute {
  id: string;
  service: 'MyCiTi Rapid Bus' | 'Table Mountain Shuttle' | 'Metrorail Southern Line' | 'Verified E-Hailing Zone';
  routeName: string;
  corridor: string;
  frequency: string;
  fareZar: string;
  status: 'On Schedule' | 'Peak Volume' | 'Weather Hold';
  accessible: boolean;
  dataOrigin: DataOrigin;
}

export interface BudgetExpense {
  id: string;
  userId?: string;
  date: string;
  description: string;
  category: 'Accommodation' | 'Tours & Passes' | 'Transport' | 'Dining';
  amountZar: number;
  paymentMethod: string;
  bookingId?: string;
  dataOrigin: DataOrigin;
}

export interface CommunityPost {
  id: string;
  authorId?: string;
  author: string;
  roleLabel: string;
  zone: string;
  timestamp: string;
  content: string;
  verifiedGuide: boolean;
  moderationStatus?: ModerationStatus;
  flaggedBy?: string;
  flagReason?: string;
  moderatedBy?: string;
  dataOrigin: DataOrigin;
}

export interface ReviewItem {
  id: string;
  authorId: string;
  authorName: string;
  targetId: string;
  rating: number;
  comment: string;
  createdAtLabel: string;
  providerReply?: string;
  providerReplyBy?: string;
  providerRepliedAt?: string;
  moderationStatus?: ModerationStatus;
  flaggedReason?: string;
  verifiedBooking?: boolean;
  dataOrigin: DataOrigin;
}

export interface AccessibilityRoute {
  id: string;
  site: string;
  surfaceType: string;
  gradientNote: string;
  restrooms: string;
  sensoryNote: string;
  status: 'Step-Free Verified' | 'Assisted Access';
  dataOrigin: DataOrigin;
}

export interface ChallengeItem {
  id: string;
  title: string;
  category: string;
  progress: number;
  target: number;
  unit: string;
  rewardNote: string;
  badgeTitle?: string;
  badgeDescription?: string;
  dataOrigin: DataOrigin;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  detail: string;
  category: 'Safety' | 'Booking' | 'Transport' | 'System';
  timestamp: string;
  read: boolean;
  dataOrigin: DataOrigin;
}

export interface ProviderApplication {
  id: string;
  ownerId?: string;
  businessName: string;
  category: string;
  zone: string;
  complianceDocs: string;
  description?: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  submittedDate: string;
  status: 'Pending Review' | 'Approved' | 'Action Required';
  safetyChecklistComplete?: boolean;
  dataOrigin: DataOrigin;
}

export interface ProviderListing {
  id: string;
  providerId?: string;
  providerName?: string;
  offeringType?: OfferingType;
  experienceTitle: string;
  category?: string;
  activityCategory?: ActivityCategory;
  zone?: string;
  description?: string;
  imageUrl?: string;
  galleryImages?: string[];
  ageRequirement?: string;
  familyFriendly?: boolean;
  includedServices?: string[];
  whatToBring?: string[];
  cancellationPolicy?: string;
  safetyInfo?: string;
  verifiedListing?: boolean;
  lat?: number;
  lng?: number;
  nearbyTransport?: string[];
  availableDates?: string[];
  durationUnit?: DurationUnit;
  defaultDurationValue?: number;
  pricingModel?: PricingModel;
  nextDeparture: string;
  bookedSeats: number;
  capacity: number;
  priceZar: number;
  accessible?: boolean;
  safetyChecklistComplete: boolean;
  status: 'Active' | 'Paused' | 'Flagged' | 'Removed';
  blockedDates?: string[];
  dataOrigin: DataOrigin;
}

export type AnnouncementCategory =
  | 'Park & Trail Notice'
  | 'Transport & Airport'
  | 'Weather & Coastal'
  | 'Visitor Advisory'
  | 'Cultural Event';

export interface DestinationAnnouncement {
  id: string;
  authorId?: string;
  authorName: string;
  title: string;
  category: AnnouncementCategory;
  zone: string;
  body: string;
  priority: 'Info' | 'Advisory' | 'Urgent';
  pinned: boolean;
  active: boolean;
  updatedAtLabel: string;
  dataOrigin: DataOrigin;
}

export interface CapeTownWeather {
  temperatureC: number;
  windSpeedKmh: number;
  windGustsKmh: number;
  conditionLabel: string;
  cablewayRisk: 'Low' | 'Moderate' | 'High';
  observedAtLabel: string;
  dataOrigin: DataOrigin;
}

export interface AiRecommendationItem {
  title: string;
  precinct: string;
  category: string;
  reason: string;
  safetyNote: string;
  bestTimeWindow: string;
  estimatedZar: number;
  stepFree: boolean;
}

export interface AiConciergeResponse {
  reply: string;
  conditionBrief: string;
  recommendations: AiRecommendationItem[];
  model: string;
  dataOrigin: DataOrigin;
}

export interface AiPlannerStop {
  day: number;
  dayLabel: string;
  time: string;
  title: string;
  zone: string;
  transportNote: string;
  safetyNote: string;
  itemType: OfferingType;
  estimatedZar: number;
}

export interface AiPlannerResponse {
  summary: string;
  totalEstimatedZar: number;
  weatherAdjustmentNote: string;
  stops: AiPlannerStop[];
  model: string;
  dataOrigin: DataOrigin;
}

export interface AiTranslationResponse {
  translatedText: string;
  pronunciationGuide: string;
  culturalEtiquetteTip: string;
  safetyPhraseVariant: string;
  model: string;
  dataOrigin: DataOrigin;
}

export interface AiExperienceRecommendation {
  listingId: string;
  title: string;
  category: string;
  precinct: string;
  matchedReason: string;
  suggestedDay: number;
  suggestedTimeWindow: string;
  estimatedZar: number;
  ageSuitability: string;
  stepFree: boolean;
  transportTip: string;
  safetyNote: string;
}

export interface AiExperienceRecommendationResponse {
  summary: string;
  advisoryNote: string;
  recommendations: AiExperienceRecommendation[];
  model: string;
  dataOrigin: DataOrigin;
}

export interface CommunityModerationResult {
  allowed: boolean;
  moderationStatus: ModerationStatus;
  reasons: string[];
  sanitizedTip?: string;
}

export interface AppAiContext {
  weather: {
    temperatureC: number;
    windSpeedKmh: number;
    windGustsKmh: number;
    conditionLabel: string;
    cablewayRisk: CapeTownWeather['cablewayRisk'];
  };
  advisories: Array<{ zone: string; severity: string; title: string; summary: string }>;
  announcements: Array<{ title: string; zone: string; priority: string; body: string }>;
  attractions: Array<{
    title: string;
    precinct: string;
    category: string;
    safetyStatus: string;
    accessibilitySummary: string;
    priceZar: number;
  }>;
  personalizationEnabled: boolean;
  userContext?: {
    location: string;
    accessibilityPriority: boolean;
    preferredLanguage: PreferredLanguage;
    confirmedBookings: Array<{
      title: string;
      offeringType?: string;
      date: string;
      zone?: string;
    }>;
    upcomingActivities: Array<{ title: string; day: number; time: string; zone: string }>;
  };
}

export interface OfflineTravelBundle {
  savedAtIso: string;
  savedAtLabel: string;
  userSummary: {
    name: string;
    location: string;
    passId: string;
    emergencyContact: string;
    preferredLanguage: PreferredLanguage;
  };
  confirmedBookings: BookingItem[];
  tripActivities: TripActivity[];
  transportRoutes: TransportRoute[];
  accessibilityRoutes: AccessibilityRoute[];
  advisoriesSnapshot: SafetyAdvisory[];
  announcementsSnapshot: DestinationAnnouncement[];
  weatherSnapshot: CapeTownWeather;
  destinationInfo: Array<{ id: string; title: string; detail: string }>;
}
