/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  auth, 
  signInWithGoogle 
} from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  Sparkles, Mail, Lock, User, AlertCircle, LogIn, ArrowRight, Loader2 
} from 'lucide-react';

interface SignInProps {
  onSignInSuccess: () => void;
}

export default function SignIn({ onSignInSuccess }: SignInProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    const targetEmail = email.trim();
    const targetPassword = password;
    
    if (!targetEmail || !targetPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (targetPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        // Register new user
        const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
        // Set display name
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, {
            displayName: displayName.trim()
          });
        }
      } else {
        // Log in existing user
        await signInWithEmailAndPassword(auth, targetEmail, targetPassword);
      }
      onSignInSuccess();
    } catch (err: any) {
      console.error('Authentication failed:', err);
      let localizedError = 'An unexpected error occurred. Please try again.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        localizedError = 'Invalid email or password. Please verify your credentials.';
      } else if (err.code === 'auth/email-already-in-use') {
        localizedError = 'An account with this email address already exists.';
      } else if (err.code === 'auth/invalid-email') {
        localizedError = 'The email address format is invalid.';
      } else if (err.code === 'auth/weak-password') {
        localizedError = 'The password is too weak.';
      }
      setErrorMsg(localizedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      onSignInSuccess();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Failed to complete Google Sign-In. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617] px-4 py-16 transition-colors duration-200 selection:bg-indigo-600 selection:text-white" id="signin-root">
      <div className="w-full max-w-md space-y-8" id="signin-card-container">
        {/* Brand Header */}
        <div className="text-center" id="signin-header">
          <div className="inline-flex w-14 h-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-500 dark:via-indigo-500 dark:to-violet-500 rounded-2xl items-center justify-center text-white font-bold mb-5 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-500/5 select-none">
            <Sparkles className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase font-sans">
            TalkPaddy <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400">Meeting AI</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2.5 max-w-xs mx-auto leading-relaxed">
            Record, transcribe, and structure your meetings with real-time audio and smart AI summaries.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 sm:p-10 shadow-md hover:shadow-lg transition-all duration-300" id="signin-form-box">
          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 text-center select-none" id="form-heading">
            {isSignUp ? 'Create Your Account' : 'Sign In To Your Account'}
          </h2>

          {/* Validation Banner */}
          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-xl p-4 flex gap-3 text-red-800 dark:text-red-200 text-sm mb-6" id="signin-error-banner">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-5" id="email-auth-form">
            {isSignUp && (
              <div id="fullname-field-group">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 select-none">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            )}

            <div id="email-field-group">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 select-none">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input 
                  type="email" 
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div id="password-field-group">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 select-none">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 dark:shadow-indigo-500/5 hover:shadow-indigo-500/20 transition-all cursor-pointer mt-3"
              id="submit-auth-btn"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Social login divider */}
          <div className="relative my-7" id="auth-divider">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800/80"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-white dark:bg-slate-900 px-4 text-slate-400 dark:text-slate-500 font-bold select-none">
                Or Continue With
              </span>
            </div>
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer"
            id="google-signin-btn"
          >
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.103C18.28 1.844 15.49 1 12.24 1 5.48 1 0 6.48 0 13.24s5.48 12.24 12.24 12.24c7.05 0 11.75-4.943 11.75-11.943 0-.807-.08-1.436-.19-2.252h-11.56z"
              />
            </svg>
            Google Workspace Account
          </button>

          {/* Switch signup/signin */}
          <div className="text-center mt-6" id="toggle-signup-link">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              disabled={isLoading}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
