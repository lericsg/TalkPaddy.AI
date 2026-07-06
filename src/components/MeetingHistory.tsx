/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Calendar, Clock, Search, Tag, Trash2, Mic, Play, 
  MessageSquare, ChevronRight, Filter, AlertTriangle, X 
} from 'lucide-react';
import { Meeting } from '../types';

interface MeetingHistoryProps {
  meetings: Meeting[];
  onSelectMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (id: string) => void;
  onStartNewRecording: () => void;
}

export default function MeetingHistory({ 
  meetings, onSelectMeeting, onDeleteMeeting, onStartNewRecording 
}: MeetingHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);

  // Helper: Format duration
  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper: Format Date
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Extract all unique tags/categories
  const allTags = Array.from(
    new Set(
      meetings.flatMap(m => m.notes?.tags || [])
    )
  );

  // Filter meetings
  const filteredMeetings = meetings.filter(m => {
    const formattedDate = formatDate(m.date).toLowerCase();
    const tagsList = m.notes?.tags || [];
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.notes?.summary && m.notes.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.transcript && m.transcript.toLowerCase().includes(searchTerm.toLowerCase())) ||
      formattedDate.includes(searchTerm.toLowerCase()) ||
      tagsList.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTag = !selectedTag || (m.notes?.tags && m.notes.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6" id="history-view">
      {/* Top dashboard summary and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pb-2" id="dashboard-header">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase font-sans">
            Archived Meetings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Access previous real-time transcripts, executive summaries, decisions, and action items.
          </p>
        </div>
        
        <button
          onClick={onStartNewRecording}
          className="flex-shrink-0 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300 cursor-pointer"
          id="new-recording-dashboard-btn"
        >
          <Mic className="w-4 h-4 text-white animate-pulse" />
          Record New Session
        </button>
      </div>

      {meetings.length === 0 ? (
        /* Gorgeous empty state */
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-16 text-center shadow-sm" id="empty-state">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100/50 dark:border-emerald-900/40 flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Mic className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">No meetings captured</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2.5 leading-relaxed">
            Begin by recording a meeting with your microphone. Gemini AI will handle the rest by transcribing and compiling structured executive summaries.
          </p>
          <button
            onClick={onStartNewRecording}
            className="mt-8 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-500/15 cursor-pointer"
            id="empty-state-record-btn"
          >
            Start Your First Recording
          </button>
        </div>
      ) : (
        <div className="space-y-6" id="history-content">
          {/* Filters Bar: Search and Tag Filter badges */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm p-5 md:p-6 space-y-5 transition-colors duration-200" id="filters-container">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
              <input 
                type="text"
                placeholder="Search meetings by title, date, notes, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl pl-11 pr-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                id="search-meetings-input"
              />
            </div>

             {/* Tag Filter badging */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/60" id="tag-filters">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1.5 select-none">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  Category:
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`text-xs px-3.5 py-1.5 rounded-lg transition-all border cursor-pointer font-semibold ${!selectedTag ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/10' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  id="filter-all-tags-btn"
                >
                  All ({meetings.length})
                </button>
                {allTags.map(tag => {
                  const tagCount = meetings.filter(m => m.notes?.tags?.includes(tag)).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`text-xs px-3.5 py-1.5 rounded-lg transition-all border cursor-pointer font-semibold ${selectedTag === tag ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/10' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      id={`filter-tag-btn-${tag}`}
                    >
                      {tag} ({tagCount})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meetings List */}
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm" id="no-search-results">
              <p className="text-sm font-medium">No archived meetings match your filters.</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedTag(null); }}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-3 cursor-pointer hover:underline"
                id="reset-search-btn"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4" id="meetings-list">
              {filteredMeetings.map(meeting => (
                <div 
                  key={meeting.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-900/80 rounded-2xl shadow-sm hover:shadow-md/5 transition-all duration-300 p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 group cursor-pointer"
                  onClick={() => onSelectMeeting(meeting)}
                  id={`meeting-card-${meeting.id}`}
                >
                  <div className="flex-grow space-y-3.5">
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
                      <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {meeting.title}
                      </h3>
                      {meeting.audioBlob && (
                        <span className="inline-flex items-center gap-1.5 text-[9px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/60 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg font-extrabold uppercase tracking-widest select-none">
                          <Play className="w-2.5 h-2.5 fill-indigo-600 dark:fill-indigo-400 text-indigo-600 dark:text-indigo-400" />
                          Audio file
                        </span>
                      )}
                    </div>

                    {/* Summary Snippet */}
                    {meeting.notes?.summary && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed pr-4 transition-colors duration-200">
                        {meeting.notes.summary}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs text-slate-400 dark:text-slate-500 font-mono transition-colors duration-200">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(meeting.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDuration(meeting.duration)}
                      </span>
                      
                      {/* Action items counter */}
                      {meeting.notes?.actionItems && meeting.notes.actionItems.length > 0 && (
                        <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800/80 px-2 py-0.5 rounded-lg transition-colors duration-205 font-sans font-semibold">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          {meeting.notes.actionItems.filter(i => i.completed).length}/{meeting.notes.actionItems.length} Checklist Done
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions / Delete */}
                  <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-slate-800/60 transition-colors duration-200">
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.notes?.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md transition-colors duration-200">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setMeetingToDelete(meeting.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all cursor-pointer"
                        title="Delete Meeting"
                        id={`delete-meeting-btn-${meeting.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all hidden md:block" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {meetingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" id="delete-modal-overlay">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-6 transition-all duration-200" id="delete-modal">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight font-sans">Delete Meeting Notes?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Are you sure you want to delete this meeting? This action is permanent and cannot be undone. All transcripts, recordings, and generated notes will be lost.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2" id="delete-modal-actions">
              <button 
                onClick={() => setMeetingToDelete(null)}
                className="px-4.5 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                id="cancel-delete-modal-btn"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteMeeting(meetingToDelete);
                  setMeetingToDelete(null);
                }}
                className="px-5 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all cursor-pointer"
                id="confirm-delete-modal-btn"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
