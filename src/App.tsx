/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getMeetings, saveMeeting, deleteMeeting 
} from './lib/db';
import { Meeting } from './types';
import MeetingHistory from './components/MeetingHistory';
import MeetingRecorder from './components/MeetingRecorder';
import MeetingDetails from './components/MeetingDetails';
import { 
  Sparkles, FileText, CheckSquare, CalendarDays, 
  Clock, Mic, Database, Loader2, Sun, Moon 
} from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'history' | 'recorder' | 'details'>('history');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Load meetings from IndexedDB on startup
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedMeetings = await getMeetings();
        setMeetings(storedMeetings);
      } catch (err) {
        console.error('Failed to load meeting records:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Handler: Save a new meeting record
  const handleSaveNewMeeting = async (newMeeting: Meeting) => {
    try {
      await saveMeeting(newMeeting);
      setMeetings(prev => [newMeeting, ...prev]);
      setSelectedMeeting(newMeeting);
      setView('details');
    } catch (err) {
      console.error('Error saving new meeting:', err);
    }
  };

  // Handler: Delete a meeting record
  const handleDeleteMeeting = async (id: string) => {
    try {
      await deleteMeeting(id);
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
    try {
      await saveMeeting(updatedMeeting);
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

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-200" id="app-root">
      {/* Navigation Topbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors duration-200" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            onClick={() => { setView('history'); setSelectedMeeting(null); }}
            className="flex items-center gap-2.5 cursor-pointer group"
            id="logo-brand"
          >
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-sm flex items-center justify-center text-white font-bold transition-all group-hover:scale-105">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-slate-900 dark:text-white text-lg uppercase">
              Meeting Notes <span className="text-blue-600 dark:text-blue-400 font-bold">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded transition-all cursor-pointer"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              id="theme-toggle-btn"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 flex items-center gap-1.5" id="sandbox-indicator">
              <Database className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">IndexedDB Storage</span>
              <span className="sm:hidden">Local</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content-stage">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400" id="global-loader">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p className="text-sm font-medium">Accessing localized meeting database...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Quick Metrics Dashboard Bar (Only show on history screen when records exist) */}
            {view === 'history' && meetings.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                id="metrics-dashboard"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-4 flex items-center gap-4 shadow-sm transition-colors duration-200">
                  <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Total Meetings</div>
                    <div className="text-xl font-bold text-slate-950 dark:text-slate-50">{meetings.length}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-4 flex items-center gap-4 shadow-sm transition-colors duration-200">
                  <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Total Recorded Hours</div>
                    <div className="text-xl font-bold text-slate-950 dark:text-slate-50">{formatTotalTime(totalDuration)}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-4 flex items-center gap-4 shadow-sm transition-colors duration-200">
                  <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Pending Tasks</div>
                    <div className="text-xl font-bold text-slate-950 dark:text-slate-50">{pendingActionItemsCount}</div>
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
    </div>
  );
}
