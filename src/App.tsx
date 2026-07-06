/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  saveMeeting, deleteMeeting 
} from './lib/db';
import { Meeting } from './types';
import MeetingHistory from './components/MeetingHistory';
import MeetingRecorder from './components/MeetingRecorder';
import MeetingDetails from './components/MeetingDetails';
import { 
  Sparkles, CheckSquare, CalendarDays, 
  Clock, Database, Loader2, Sun, Moon, LogOut, User as UserIcon
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, logOut } from './lib/firebase';
import { 
  saveMeetingToFirestore, 
  fetchMeetingsFromFirestore, 
  deleteMeetingFromFirestore 
} from './lib/firestoreService';
import SignIn from './components/SignIn';
import { LogoFull } from './components/Logo';

export default function App() {
  const [view, setView] = useState<'history' | 'recorder' | 'details'>('history');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Dark mode theme selection
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Listen for user authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setUserLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load meetings from Firestore whenever the user changes
  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setMeetings([]);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const storedMeetings = await fetchMeetingsFromFirestore(user.uid);
        setMeetings(storedMeetings);
      } catch (err) {
        console.error('Failed to load meeting records from Firestore:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, userLoading]);

  // Handler: Save a new meeting record
  const handleSaveNewMeeting = async (newMeeting: Meeting) => {
    if (!user) return;
    try {
      // 1. Save locally to IndexedDB (keeps audioBlob)
      await saveMeeting(newMeeting);
      // 2. Save text data to Firestore (excludes audioBlob)
      await saveMeetingToFirestore(newMeeting, user.uid);

      setMeetings(prev => [newMeeting, ...prev]);
      setSelectedMeeting(newMeeting);
      setView('details');
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 5000);
    } catch (err) {
      console.error('Error saving new meeting:', err);
    }
  };

  // Handler: Delete a meeting record
  const handleDeleteMeeting = async (id: string) => {
    try {
      await deleteMeeting(id);
      await deleteMeetingFromFirestore(id);
      setMeetings(prev => prev.filter(m => m.id !== id));
      if (selectedMeeting?.id === id) {
        setSelectedMeeting(null);
        setView('history');
      }
    } catch (err) {
      console.error('Error deleting meeting record:', err);
    }
  };

  // Handler: Update a meeting record (e.g. checking off action items, edit details)
  const handleUpdateMeeting = async (updatedMeeting: Meeting) => {
    if (!user) return;
    try {
      await saveMeeting(updatedMeeting);
      await saveMeetingToFirestore(updatedMeeting, user.uid);
      setMeetings(prev => prev.map(m => m.id === updatedMeeting.id ? updatedMeeting : m));
      setSelectedMeeting(updatedMeeting);
    } catch (err) {
      console.error('Error updating meeting record:', err);
    }
  };

  // Helper: Format duration to human readable format
  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  // Calculate quick dynamic statistics
  const totalDuration = meetings.reduce((sum, m) => sum + m.duration, 0);
  
  const pendingActionItemsCount = meetings.reduce((sum, m) => {
    if (!m.notes?.actionItems) return sum;
    const pending = m.notes.actionItems.filter(item => !item.completed).length;
    return sum + pending;
  }, 0);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] dark:bg-slate-950 flex flex-col items-center justify-center text-slate-400" id="global-auth-loader">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm font-medium uppercase tracking-wider font-mono">Verifying Session...</p>
      </div>
    );
  }

  if (!user) {
    return <SignIn onSignInSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 selection:bg-indigo-600 selection:text-white transition-colors duration-200" id="app-root">
      {/* Navigation Topbar */}
      <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-40 transition-all duration-200" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            onClick={() => { setView('history'); setSelectedMeeting(null); }}
            className="cursor-pointer select-none"
            id="logo-brand"
          >
            <LogoFull variant="horizontal" iconSize={36} />
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2.5 mr-2 border-r border-slate-200/60 dark:border-slate-800/60 pr-3" id="user-profile-badge">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-inner">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 leading-none">{user.displayName || 'Guest User'}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-none">{user.email}</div>
                </div>
                <button
                  onClick={async () => {
                    await logOut();
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer ml-1.5"
                  title="Sign Out"
                  id="signout-btn"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg shadow-sm hover:shadow-md/5 transition-all cursor-pointer"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              id="theme-toggle-btn"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg px-2.5 py-2 flex items-center gap-2 shadow-sm select-none" id="sandbox-indicator">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Cloud Firestore synced</span>
              <span className="sm:hidden">Cloud synced</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content-stage">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400" id="global-loader">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
            <p className="text-sm font-medium tracking-wide">Syncing meeting archives...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Quick Metrics Dashboard Bar (Only show on history screen when records exist) */}
            {view === 'history' && meetings.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-5"
                id="metrics-dashboard"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md/5 transition-all duration-300">
                  <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest font-sans">Total Meetings</div>
                    <div className="text-2xl font-black text-slate-950 dark:text-white mt-0.5 tracking-tight font-mono">{meetings.length}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md/5 transition-all duration-300">
                  <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest font-sans">Total Recorded Hours</div>
                    <div className="text-2xl font-black text-slate-950 dark:text-white mt-0.5 tracking-tight font-mono">{formatTotalTime(totalDuration)}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md/5 transition-all duration-300">
                  <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest font-sans">Pending Tasks</div>
                    <div className="text-2xl font-black text-slate-950 dark:text-white mt-0.5 tracking-tight font-mono">{pendingActionItemsCount}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Stage Routing Views */}
            <AnimatePresence mode="wait">
              {view === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <MeetingHistory 
                    meetings={meetings}
                    onSelectMeeting={(meeting) => {
                      setSelectedMeeting(meeting);
                      setView('details');
                    }}
                    onDeleteMeeting={handleDeleteMeeting}
                    onStartNewRecording={() => setView('recorder')}
                  />
                </motion.div>
              )}

              {view === 'recorder' && (
                <motion.div
                  key="recorder"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <MeetingRecorder 
                    onMeetingSaved={handleSaveNewMeeting}
                    onCancel={() => setView('history')}
                  />
                </motion.div>
              )}

              {view === 'details' && selectedMeeting && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <MeetingDetails 
                    meeting={selectedMeeting}
                    onBack={() => {
                      setSelectedMeeting(null);
                      setView('history');
                    }}
                    onUpdateMeeting={handleUpdateMeeting}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-emerald-600 dark:bg-emerald-500 text-white font-bold text-sm px-5 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center gap-2.5 border border-emerald-500/40"
            id="success-toast"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Meeting saved & AI notes compiled successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
