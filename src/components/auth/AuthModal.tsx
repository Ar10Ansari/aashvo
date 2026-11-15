import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  User as UserIcon,
  Home,
  Briefcase,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  signInWithBackend,
  signInWithGoogleBackend,
  signUpWithBackend,
  forgotPasswordWithBackend,
  resetPasswordWithBackend,
  resendVerificationWithBackend,
  isValidPassword,
  isValidEmail,
} from '../../services/authService';
import { apiClient } from '../../services/apiClient';

interface AuthModalProps {
  onClose: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery' | 'personas';

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { loginAs, setCurrentUser, authModalMode, setAuthModalMode } = useApp();
  const [mode, setMode] = useState<AuthMode>(authModalMode || 'signin');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync with global authModalMode
  React.useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
    }
  }, [authModalMode]);

  // Password validation hint
  const passwordValidation = password.length > 0 ? isValidPassword(password) : null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    setEmailUnconfirmed(false);
    try {
      const res = await signInWithBackend(email, password);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        onClose();
      } else {
        setErrorMessage(res.error || 'Invalid email or password.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter your email address to resend verification.');
      return;
    }
    setResendingEmail(true);
    try {
      const res = await resendVerificationWithBackend(email);
      if (res.success) {
        setSuccessMessage(res.message || 'Verification email resent! Please check your inbox.');
      } else {
        setErrorMessage(res.error || 'Failed to resend verification email.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const check = isValidPassword(password);
    if (!check.valid) {
      setErrorMessage(check.reason || 'Password does not meet requirements.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUpWithBackend({
        email,
        password,
        fullName,
      });

      if (res.success && res.user) {
        setCurrentUser(res.user);
        onClose();
      } else {
        setErrorMessage(res.error || 'Registration failed.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordWithBackend(email);
      if (res.success) {
        setSuccessMessage('If an account exists with this email, password reset instructions have been sent to your inbox.');
      } else {
        setErrorMessage(res.error || 'Failed to request password reset.');
      }
    } catch {
      setSuccessMessage('If an account exists with this email, password reset instructions have been sent.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const check = isValidPassword(password);
    if (!check.valid) {
      setErrorMessage(check.reason || 'Password does not meet requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const recoveryToken = urlParams.get('token') || '';
    if (!recoveryToken) {
      setErrorMessage('Missing password reset token in URL. Please open the link received in your reset email.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithBackend(recoveryToken, password);
      if (res.success) {
        setSuccessMessage('Your password has been updated successfully! Please sign in with your new password.');
        setTimeout(() => {
          setMode('signin');
          setAuthModalMode('signin');
          setPassword('');
          setConfirmPassword('');
          setSuccessMessage(null);
        }, 2500);
      } else {
        setErrorMessage(res.error || 'Password update failed.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      setErrorMessage(
        'Google OAuth is not configured in this environment (missing VITE_GOOGLE_CLIENT_ID). Please sign in or register with your email and password.',
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      if (typeof window !== 'undefined' && !(window as any).google?.accounts?.id) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.getElementById('google-gsi-script');
          if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () =>
              reject(new Error('Failed to load Google Identity Services.')),
            );
            return;
          }
          const script = document.createElement('script');
          script.id = 'google-gsi-script';
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error('Failed to load Google Identity Services.'));
          document.head.appendChild(script);
        });
      }

      const google = (window as any).google;
      if (!google?.accounts?.id) {
        throw new Error('Google Identity Services SDK could not be initialized.');
      }

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response?.credential) {
            setErrorMessage('Google authentication did not return a credential.');
            setLoading(false);
            return;
          }
          try {
            setLoading(true);
            const res = await signInWithGoogleBackend(response.credential);
            if (res.success && res.user) {
              setCurrentUser(res.user);
              onClose();
            } else {
              setErrorMessage(res.error || 'Google sign-in failed.');
            }
          } catch (err: unknown) {
            setErrorMessage(
              err instanceof Error ? err.message : 'Google sign-in failed.',
            );
          } finally {
            setLoading(false);
          }
        },
      });

      google.accounts.id.prompt((notification: any) => {
        if (
          notification?.isNotDisplayed?.() ||
          notification?.isSkippedMoment?.() ||
          notification?.isDismissedMoment?.()
        ) {
          setLoading(false);
          if (notification?.isNotDisplayed?.()) {
            const reason =
              typeof notification.getNotDisplayedReason === 'function'
                ? notification.getNotDisplayedReason()
                : '';
            if (reason === 'unregistered_origin') {
              setErrorMessage(
                'Google Sign-In failed: This origin is not authorized in Google Cloud Console. Please check Authorized JavaScript Origins.',
              );
            } else if (
              reason === 'opt_out_or_nested_iframe' ||
              reason === 'suppressed_by_user'
            ) {
              setErrorMessage(
                'Google Sign-In prompt was suppressed by browser settings. Please sign in or register with your email and password.',
              );
            }
          }
        }
      });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to initialize Google Sign-In.',
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-auth-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-charcoal-100 flex items-center justify-between bg-ivory-100/90">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
                Aashvo Account
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                Cloud API Active
              </span>
            </div>
            <h2 id="modal-auth-title" className="font-serif text-2xl font-bold text-charcoal-900 mt-0.5">
              {mode === 'signin' && 'Welcome Back'}
              {mode === 'signup' && 'Create Your Account'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'recovery' && 'Set New Password'}
              {mode === 'personas' && 'Switch Demo Persona'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-800 rounded-full hover:bg-ivory-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-2 border-b border-charcoal-100 flex items-center justify-between text-xs font-semibold text-charcoal-600 bg-white">
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`pb-2 border-b-2 transition-all ${
                mode === 'signin' ? 'border-forest-700 text-forest-900 font-bold' : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`pb-2 border-b-2 transition-all ${
                mode === 'signup' ? 'border-forest-700 text-forest-900 font-bold' : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
              }`}
            >
              Register
            </button>
          </div>

          <button
            onClick={() => {
              setMode('personas');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`pb-2 text-[11px] font-semibold flex items-center space-x-1 ${
              mode === 'personas' ? 'text-forest-800 underline' : 'text-sand-600 hover:text-sand-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demo Personas</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Backend Engine Health Indicator */}
          <div className="mb-4 px-3 py-1.5 rounded-xl text-[11px] font-medium flex items-center justify-between border bg-ivory-100/80 border-charcoal-200/50">
            <span className="text-charcoal-600">Auth Engine:</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-forest-800">
              <span className="w-2 h-2 rounded-full bg-forest-600 animate-pulse" />
              AASHVO API ({apiClient.getBaseUrl()})
            </span>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex flex-col space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              {emailUnconfirmed && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingEmail}
                    className="text-xs bg-forest-800 hover:bg-forest-900 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                  >
                    {resendingEmail ? 'Sending Link...' : 'Resend Verification Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. rohan@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-charcoal-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-forest-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-forest-800 hover:bg-forest-900 active:bg-forest-950 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-charcoal-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-charcoal-400 font-semibold">Or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-2.5 border border-charcoal-200 hover:bg-ivory-100 rounded-xl text-xs font-semibold text-charcoal-800 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. priya@university.ac.in"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
                {passwordValidation && !passwordValidation.valid && (
                  <p className="text-[11px] text-amber-700 mt-1">{passwordValidation.reason}</p>
                )}
                {passwordValidation && passwordValidation.valid && (
                  <p className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Strong password</span>
                  </p>
                )}
              </div>

              <p className="text-[11px] text-charcoal-400 leading-relaxed">
                By registering, you agree to Aashvo&apos;s Community Guidelines and Zero-Advance-Payment Safety Policy.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-forest-800 hover:bg-forest-900 active:bg-forest-950 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-charcoal-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-charcoal-400 font-semibold">Or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-2.5 border border-charcoal-200 hover:bg-ivory-100 rounded-xl text-xs font-semibold text-charcoal-800 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign up with Google</span>
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-xs text-charcoal-500 leading-relaxed">
                Enter your registered email address. If an account exists, we will send instructions to reset your password.
              </p>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. rohan@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-center text-xs text-forest-700 hover:underline pt-2 font-medium"
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* 4. RECOVERY (SET NEW PASSWORD) */}
          {mode === 'recovery' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <p className="text-xs text-charcoal-500 leading-relaxed">
                Create a strong new password for your Aashvo account.
              </p>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
                {passwordValidation && !passwordValidation.valid && (
                  <p className="text-[11px] text-amber-700 mt-1">{passwordValidation.reason}</p>
                )}
                {passwordValidation && passwordValidation.valid && (
                  <p className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Strong password</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 rounded-xl border border-charcoal-200 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-center text-xs text-forest-700 hover:underline pt-2 font-medium"
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* 4. DEMO PERSONAS SWITCHER */}
          {mode === 'personas' && (
            <div className="space-y-2.5">
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed mb-3">
                <span className="font-bold">🛡️ Non-Privileged Preview Mode: </span>
                Demo personas provide read-only interface previews for testing UI flows. They do not grant verified identity, property ownership, or administrative permissions.
              </div>

              <button
                onClick={() => {
                  loginAs('renter', 'Rohan Varma');
                  onClose();
                }}
                className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-bold text-charcoal-900">Rohan Varma</span>
                    <span className="text-[10px] bg-ivory-200 text-charcoal-700 px-2 py-0.5 rounded-full font-semibold">
                      DEMO RENTER
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-500">Prospective student / software engineer looking in Gurugram</p>
                </div>
              </button>

              <button
                onClick={() => {
                  loginAs('owner', 'Anil Mehra (DLF Owner)');
                  onClose();
                }}
                className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                  <Home className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-bold text-charcoal-900">Anil Mehra</span>
                    <span className="text-[10px] bg-forest-100 text-forest-800 px-2 py-0.5 rounded-full font-semibold">
                      DEMO OWNER
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-500">Property Owner in DLF Phase 4 (₹0 Brokerage view)</p>
                </div>
              </button>

              <button
                onClick={() => {
                  loginAs('broker', 'Rajesh Kumar (Verified Manager)');
                  onClose();
                }}
                className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-bold text-charcoal-900">Rajesh Kumar</span>
                    <span className="text-[10px] bg-charcoal-100 text-charcoal-800 px-2 py-0.5 rounded-full font-semibold">
                      DEMO MANAGER
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-500">Property Manager in Saket with declared fee breakdown</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
