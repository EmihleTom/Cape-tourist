import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Lock, Mail, Shield, User } from 'lucide-react';
import { BrandMark } from '@/src/components/common/BrandMark';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { HERO_IMAGE_URL } from '@/src/data/demoData';
import { ROLE_LABELS } from '@/src/data/navigation';
import { authService, mapFirebaseAuthError } from '@/src/services/firebase/authService';
import type { DemoUser, UserRole } from '@/src/types/app';

interface AuthPagesProps {
  mode: 'login' | 'register';
  onSwitchMode: (mode: 'login' | 'register') => void;
  onBackLanding: () => void;
  onAuthenticated: (user: DemoUser) => void;
}

export const AuthPages: React.FC<AuthPagesProps> = ({
  mode,
  onSwitchMode,
  onBackLanding,
  onAuthenticated,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('tourist');
  const [organization, setOrganization] = useState('');
  const [accessibilityPriority, setAccessibilityPriority] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');

    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email address and a password of at least 6 characters.');
      return;
    }

    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Please enter your full name to register.');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === 'login'
          ? await authService.signInWithEmail({ email, password })
          : await authService.registerAccount({
              fullName,
              email,
              password,
              role,
              organization,
              accessibilityPriority,
            });
      onAuthenticated(result.user);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setResetSuccess('');
    setSubmitting(true);
    try {
      const result = await authService.signInWithGoogle(role);
      onAuthenticated(result.user);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail.includes('@')) {
      setError('Enter your registered email address to receive a password reset link.');
      return;
    }

    setSubmitting(true);
    try {
      await authService.sendPasswordReset(targetEmail);
      setResetSuccess(`Password reset email sent to ${targetEmail}. Check your inbox and spam folder.`);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoQuickLogin = async (demoRole: UserRole) => {
    setSubmitting(true);
    try {
      const result = await authService.signInWithRoleDemo(demoRole);
      onAuthenticated(result.user);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-12">
      {/* Left Architectural Visual Panel */}
      <div className="relative hidden flex-col justify-between bg-[#0B1F3A] p-10 text-white lg:col-span-5 lg:flex">
        <div>
          <button
            type="button"
            onClick={onBackLanding}
            className="inline-flex items-center gap-2 text-xs font-medium text-teal-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to overview
          </button>
          <div className="mt-8">
            <BrandMark inverted />
          </div>
          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight text-balance leading-tight">
            One platform for Cape Town exploration, accredited bookings, and coastal safety.
          </h1>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Connected to Firebase Authentication, Firestore, and Storage with role-based access control across Tourist, Administrator, Service Provider, and Safety Management portals.
          </p>
        </div>

        <div className="space-y-4">
          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-white/15">
            <ImageWithFallback
              src={HERO_IMAGE_URL}
              alt="Cape Town waterfront and Table Mountain coastal view"
            />
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#14B8A6] shrink-0" aria-hidden="true" />
              <span>Firebase Authentication with Google Sign-In, email verification &amp; password reset</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#14B8A6] shrink-0" aria-hidden="true" />
              <span>Role-isolated Firestore records and private emergency contact storage</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right Form & Demo Access */}
      <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:col-span-7 lg:px-16">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div className="flex items-center justify-between lg:hidden">
            <BrandMark />
            <button
              type="button"
              onClick={onBackLanding}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Overview
            </button>
          </div>

          <DemoDataNotice compact scope="Firebase Auth & Firestore connected · Demo quick-preview also available below" />

          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">
                  {showResetForm
                    ? 'Reset your password'
                    : mode === 'login'
                    ? 'Sign in to CapeSafe 360'
                    : 'Create your account'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {showResetForm
                    ? 'Receive a Firebase password reset link via email.'
                    : mode === 'login'
                    ? 'Sign in to redirect automatically to your role dashboard.'
                    : 'Register as a Cape Town traveler, service provider, or safety officer.'}
                </p>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetSuccess('');
                    setShowResetForm(false);
                    onSwitchMode('login');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'login' && !showResetForm ? 'bg-[#0B1F3A] text-white' : 'text-slate-600'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetSuccess('');
                    setShowResetForm(false);
                    onSwitchMode('register');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'register' && !showResetForm ? 'bg-[#0B1F3A] text-white' : 'text-slate-600'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {showResetForm ? (
              <form onSubmit={handlePasswordReset} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700">
                    Registered Email Address
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                )}

                {resetSuccess && (
                  <p role="status" className="rounded-lg border border-green-200 bg-[#F0FDF4] px-3 py-2 text-xs text-[#15803D]">
                    {resetSuccess}
                  </p>
                )}

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-[#0D9488] py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors"
                  >
                    {submitting ? 'Sending Reset Link...' : 'Send Password Reset Email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetForm(false);
                      setError('');
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {mode === 'register' && (
                    <div>
                      <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-700">
                        Full Name
                      </label>
                      <div className="relative mt-1.5">
                        <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                        <input
                          id="auth-fullname"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Maya van der Merwe"
                          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700">
                      Email Address
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                        Password
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmail(email);
                            setError('');
                            setResetSuccess('');
                            setShowResetForm(true);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#0D9488] hover:text-[#0F766E]"
                        >
                          <KeyRound className="h-3 w-3" aria-hidden="true" />
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative mt-1.5">
                      <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                      <input
                        id="auth-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                      />
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div>
                      <label htmlFor="auth-role" className="block text-xs font-semibold text-slate-700">
                        Requested Portal Role
                      </label>
                      <select
                        id="auth-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                      >
                        <option value="tourist">Tourist</option>
                        <option value="provider">Tourism Service Provider (Admin Approval)</option>
                        <option value="safety">Safety Management Personnel (Admin Approval)</option>
                        <option value="admin">Tourism Administrator (Admin Approval)</option>
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">
                        New accounts start with Tourist privileges until verified and promoted by a Tourism Administrator.
                      </p>
                    </div>
                  )}

                  {mode === 'register' && (role === 'provider' || role === 'safety') && (
                    <div>
                      <label htmlFor="auth-org" className="block text-xs font-semibold text-slate-700">
                        Organization / Operator Name
                      </label>
                      <input
                        id="auth-org"
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="Peninsula Eco Charters"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                      />
                    </div>
                  )}

                  {mode === 'register' && (
                    <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={accessibilityPriority}
                        onChange={(e) => setAccessibilityPriority(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
                      />
                      <span>Prioritize step-free routes, sensory-friendly windows, and accessible transit suggestions</span>
                    </label>
                  )}

                  {error && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-[#0D9488] py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors"
                  >
                    {submitting
                      ? 'Authenticating...'
                      : mode === 'login'
                      ? 'Sign In with Email'
                      : 'Create Firebase Account'}
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-[#0B1F3A] hover:bg-slate-50 disabled:opacity-60 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </div>

          {/* 1-Click Demonstration Role Selector */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-[#0B1F3A]">
                  Offline Demonstration Role Preview
                </h3>
              </div>
              <span className="font-mono text-[11px] text-slate-500">Demo Accounts</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Preview any role dashboard using local sample records without signing into Firebase:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleDemoQuickLogin(r)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-[#0B1F3A] hover:border-[#0D9488] hover:bg-[#F0FDFA] transition-colors whitespace-nowrap"
                >
                  {ROLE_LABELS[r].short}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
