import React, { useState } from 'react';
import {
  Database,
  HardDriveDownload,
  Lock,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import { PWAInstallButton } from '@/src/components/pwa/PWAInstallButton';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { getArchitectureReadiness } from '@/src/services/firebase/config';
import { dataService } from '@/src/services/firebase/dataService';
import { storageService } from '@/src/services/firebase/storageService';
import type {
  DemoUser,
  OfflineTravelBundle,
  PreferredLanguage,
  ProfileVisibility,
} from '@/src/types/app';

interface SettingsPageProps {
  user: DemoUser;
  offlineBundle: OfflineTravelBundle | null;
  onUpdateUser: (updates: Partial<DemoUser>) => void;
  onSaveOfflineBundle: () => OfflineTravelBundle;
  onClearOfflineBundle: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  offlineBundle,
  onUpdateUser,
  onSaveOfflineBundle,
  onClearOfflineBundle,
}) => {
  const [name, setName] = useState(user.name);
  const [emergencyContact, setEmergencyContact] = useState(user.emergencyContact || '');
  const [location, setLocation] = useState(user.location);

  // Privacy & Personalization controls
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    user.profileVisibility || 'public_guides'
  );
  const [shareLocationConsent, setShareLocationConsent] = useState(
    Boolean(user.shareLocationConsent)
  );
  const [aiContextPersonalization, setAiContextPersonalization] = useState(
    user.aiContextPersonalization !== false
  );
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>(
    user.preferredLanguage || 'English'
  );
  const [accessibilityPriority, setAccessibilityPriority] = useState(
    Boolean(user.accessibilityPriority)
  );

  const [savedNotice, setSavedNotice] = useState('');
  const [privacyNotice, setPrivacyNotice] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  const [showOfflineSnapshot, setShowOfflineSnapshot] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const isOnline = useOnlineStatus();
  const readiness = getArchitectureReadiness();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice('');
    setErrorNotice('');
    setSavingProfile(true);
    try {
      const nextName = name.trim() || user.name;
      const nextLoc = location.trim() || user.location;
      const nextIce = emergencyContact.trim();

      if (user.authMode === 'firebase' && user.emailVerified) {
        await dataService.updateUserProfile(user.id, {
          displayName: nextName,
          location: nextLoc,
          emergencyContact: nextIce,
        });
        setSavedNotice('Profile saved to Cloud Firestore.');
      } else {
        setSavedNotice('Profile updated in local demonstration session.');
      }

      onUpdateUser({
        name: nextName,
        emergencyContact: nextIce,
        location: nextLoc,
      });
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to save profile changes.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrivacyNotice('');
    setErrorNotice('');
    setSavingPrivacy(true);
    try {
      if (user.authMode === 'firebase' && user.emailVerified) {
        await dataService.updateUserProfile(user.id, {
          profileVisibility,
          shareLocationConsent,
          aiContextPersonalization,
          preferredLanguage,
          accessibilityPriority,
        });
        setPrivacyNotice('Privacy, AI, and language controls saved to Cloud Firestore.');
      } else {
        setPrivacyNotice('Privacy, AI, and language preferences updated for this session.');
      }

      onUpdateUser({
        profileVisibility,
        shareLocationConsent,
        aiContextPersonalization,
        preferredLanguage,
        accessibilityPriority,
      });
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to save privacy preferences.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorNotice('');
    setSavedNotice('');

    if (user.authMode !== 'firebase' || !user.emailVerified) {
      setErrorNotice('Sign in with a verified Firebase account to upload photos to Firebase Storage.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const downloadUrl = await storageService.uploadUserAvatar(user.id, file);
      await dataService.updateUserProfile(user.id, { photoUrl: downloadUrl });
      onUpdateUser({ avatarUrl: downloadUrl });
      setSavedNotice('Profile photo uploaded to Firebase Storage and synced to Firestore.');
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase'
            ? `Connected to Firebase project ${readiness.projectIdLabel}`
            : 'Local demo profile session; sign in with Firebase for cloud persistence & Storage'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Profile Settings */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="font-display text-xl font-bold text-[#0B1F3A]">User Profile &amp; Settings</h1>
            <p className="mt-1 text-xs text-slate-600">
              Manage traveler identity, profile photo (Firebase Storage), and emergency contact details.
            </p>

            {/* Avatar Upload Row */}
            <div className="mt-5 flex items-center gap-4 border-b border-slate-200 pb-5">
              <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shrink-0">
                {user.avatarUrl ? (
                  <ImageWithFallback src={user.avatarUrl} alt={user.name} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#0B1F3A] font-display text-base font-bold text-teal-300">
                    {user.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 transition-colors">
                  <Upload className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
                  {uploadingPhoto ? 'Uploading to Storage...' : 'Upload Profile Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  Stored securely at <span className="font-mono">users/{user.id}/avatar/</span> (max 5 MB).
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label htmlFor="set-name" className="block text-xs font-semibold text-slate-700">
                  Display Name
                </label>
                <input
                  id="set-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="set-loc" className="block text-xs font-semibold text-slate-700">
                  Base Precinct in Cape Town
                </label>
                <input
                  id="set-loc"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="set-ice" className="block text-xs font-semibold text-slate-700">
                  Emergency Contact (ICE)
                </label>
                <input
                  id="set-ice"
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              {savedNotice && <p className="text-xs font-medium text-[#15803D]">{savedNotice}</p>}
              {errorNotice && <p className="text-xs font-medium text-red-700">{errorNotice}</p>}

              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </section>

          {/* Privacy, AI Personalization & Language Controls */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Privacy Controls &amp; AI Preferences
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Control how your identity appears in the Community Hub, whether location sharing defaults on, and what trip context CapeSafe AI can reference.
            </p>

            <form onSubmit={handleSavePrivacy} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="priv-vis" className="block text-xs font-semibold text-slate-700">
                    Community Post Display Visibility
                  </label>
                  <select
                    id="priv-vis"
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value as ProfileVisibility)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="public_guides">Full Display Name</option>
                    <option value="initials_only">Initials Only (e.g., M. v. d. M.)</option>
                    <option value="private">Anonymous (&ldquo;CapeSafe Traveler&rdquo;)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="priv-lang" className="block text-xs font-semibold text-slate-700">
                    Preferred Assistant Language
                  </label>
                  <select
                    id="priv-lang"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as PreferredLanguage)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="English">English</option>
                    <option value="Afrikaans">Afrikaans</option>
                    <option value="isiXhosa">isiXhosa</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={aiContextPersonalization}
                    onChange={(e) => setAiContextPersonalization(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488]"
                  />
                  <span>
                    <strong className="block font-semibold text-[#0B1F3A]">
                      Personalized AI Trip Context
                    </strong>
                    <span className="text-slate-600">
                      Allow CapeSafe AI to tailor suggestions using your confirmed bookings, base precinct, and accessibility settings (no PII/email is sent).
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={shareLocationConsent}
                    onChange={(e) => setShareLocationConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488]"
                  />
                  <span>
                    <strong className="block font-semibold text-[#0B1F3A]">
                      Default Incident &amp; Check-In Location Opt-In
                    </strong>
                    <span className="text-slate-600">
                      Pre-authorize GPS coordinate sharing when starting a trail Check-In (you can revoke per incident anytime).
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={accessibilityPriority}
                    onChange={(e) => setAccessibilityPriority(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488]"
                  />
                  <span>
                    <strong className="block font-semibold text-[#0B1F3A]">
                      Prioritize Step-Free Accessibility Routes
                    </strong>
                    <span className="text-slate-600">
                      Rank accessible boardwalks, MyCiTi bays, and Gemini AI plans first across the platform.
                    </span>
                  </span>
                </label>
              </div>

              {privacyNotice && <p className="text-xs font-medium text-[#15803D]">{privacyNotice}</p>}

              <button
                type="submit"
                disabled={savingPrivacy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#132f57] disabled:opacity-60 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {savingPrivacy ? 'Saving Preferences...' : 'Save Privacy & AI Controls'}
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Offline Travel Mode + PWA + Firebase */}
        <section className="space-y-4 lg:col-span-5">
          {/* Offline Travel Mode Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDriveDownload className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                  Offline Travel Mode
                </h2>
              </div>
              <StatusText
                label={offlineBundle ? 'Packet Saved' : 'Not Saved'}
                tone={offlineBundle ? 'nominal' : 'advisory'}
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <strong>Saved Information Notice:</strong> Offline travel packets store a local snapshot of your pass, bookings, trips, transit bays, and weather/advisories as <strong>saved information — not live data</strong>.
            </div>

            {offlineBundle && (
              <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Last Saved Snapshot</span>
                  <span className="font-mono font-semibold text-[#0B1F3A]">
                    {offlineBundle.savedAtLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cached Items</span>
                  <span className="font-mono text-[#0D9488]">
                    {offlineBundle.confirmedBookings.length} passes · {offlineBundle.tripActivities.length} stops · {offlineBundle.advisoriesSnapshot.length} advisories
                  </span>
                </div>
              </div>
            )}

            {offlineNotice && (
              <p className="text-xs font-medium text-[#15803D]">{offlineNotice}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const bundle = onSaveOfflineBundle();
                  setOfflineNotice(`Saved offline travel packet (${bundle.savedAtLabel}).`);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0F766E]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Save / Refresh Offline Packet
              </button>
              {offlineBundle && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowOfflineSnapshot((prev) => !prev)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
                  >
                    {showOfflineSnapshot ? 'Hide Saved Packet' : 'View Saved Packet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearOfflineBundle();
                      setShowOfflineSnapshot(false);
                      setOfflineNotice('Cleared local offline travel packet.');
                    }}
                    aria-label="Clear saved offline cache"
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {showOfflineSnapshot && offlineBundle && (
              <div className="mt-3 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <p className="font-mono text-[11px] font-bold uppercase text-amber-800">
                  Saved Offline Snapshot ({offlineBundle.savedAtLabel}) — Not Live Data
                </p>
                <p className="text-slate-700">
                  <strong>Pass ID:</strong> {offlineBundle.userSummary.passId} · <strong>ICE:</strong> {offlineBundle.userSummary.emergencyContact}
                </p>
                <p className="text-slate-700">
                  <strong>Saved Weather Snapshot:</strong> {offlineBundle.weatherSnapshot.temperatureC}°C, Wind {offlineBundle.weatherSnapshot.windSpeedKmh} km/h ({offlineBundle.weatherSnapshot.conditionLabel})
                </p>
                <div>
                  <p className="font-semibold text-[#0B1F3A]">Saved Emergency &amp; Visitor Info:</p>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                    {offlineBundle.destinationInfo.map((d) => (
                      <li key={d.id}>
                        <strong>{d.title}:</strong> {d.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                PWA Offline &amp; Installation
              </h2>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Network Connectivity</span>
              <StatusText
                label={isOnline ? 'Online' : 'Offline Mode (Saved Data)'}
                tone={isOnline ? 'nominal' : 'advisory'}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Service Worker Manifest</span>
              <StatusText label="Configured" tone="nominal" />
            </div>
            <div className="pt-1">
              <PWAInstallButton />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#0B1F3A]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                Firebase Cloud Configuration
              </h2>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Project ID</span>
                <span className="font-mono text-[#0B1F3A]">{readiness.projectIdLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Firestore Database</span>
                <span className="font-mono text-[#0D9488] truncate max-w-[180px]" title={readiness.databaseIdLabel}>
                  {readiness.databaseIdLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Firebase Storage</span>
                <StatusText label={readiness.storageReady ? 'Configured' : 'Inactive'} tone="nominal" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Config Source</span>
                <span className="font-mono text-[#15803D]">
                  {(import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_FIREBASE_PROJECT_ID
                    ? 'VITE_FIREBASE_* override'
                    : 'Auto-loaded (firebase-applet-config.json)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Active Session Mode</span>
                <span className="font-mono font-semibold text-[#0B1F3A]">
                  {user.authMode === 'firebase' ? 'Firebase Auth' : 'Demo Session'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
