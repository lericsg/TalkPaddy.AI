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
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.notes?.summary && m.notes.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.transcript && m.transcript.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTag = !selectedTag || (m.notes?.tags && m.notes.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6" id="history-view">
      {/* Top dashboard summary and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" id="dashboard-header">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
            Recorded Meetings
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Access previous transcripts, summaries, and action items.
          </p>
        </div>
        
        <button
          onClick={onStartNewRecording}
          className="flex-shrink-0 px-5 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-200"
          id="new-recording-dashboard-btn"
        >
          <Mic className="w-4 h-4 text-white" />
          Record Meeting
        </button>
      </div>

      {meetings.length === 0 ? (
        /* Gorgeous empty state */
        <div className="bg-white rounded border border-dashed border-slate-300 p-12 text-center shadow-sm" id="empty-state">
          <div className="w-16 h-16 rounded bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
            <Mic className="w-7 h-7 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">No meetings recorded yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
            Begin by recording a meeting with your microphone. Gemini 3.5 Flash will handle the rest by transcribing and summarizing.
          </p>
          <button
            onClick={onStartNewRecording}
            className="mt-6 px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-sm"
            id="empty-state-record-btn"
          >
            Start Your First Recording
          </button>
        </div>
      ) : (
        <div className="space-y-6" id="history-content">
          {/* Filters Bar: Search and Tag Filter badges */}
          <div className="bg-white rounded border border-slate-200 shadow-sm p-4 md:p-6 space-y-4" id="filters-container">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Search meetings by title, notes, or transcript..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded pl-10 pr-4 py-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent"
                id="search-meetings-input"
              />
            </div>

            {/* Tag Filter badging */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200" id="tag-filters">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filter:
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`text-xs px-3 py-1.5 rounded transition-all border ${!selectedTag ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
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
                      className={`text-xs px-3 py-1.5 rounded transition-all border ${selectedTag === tag ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
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
            <div className="text-center py-12 text-slate-400 bg-white rounded border border-slate-200 shadow-sm" id="no-search-results">
              <p className="text-sm font-medium">No meetings match your search query or selected category.</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedTag(null); }}
                className="text-xs text-blue-600 underline mt-2 font-bold uppercase tracking-wider"
                id="reset-search-btn"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4" id="meetings-list">
              {filteredMeetings.map(meeting => (
                <div 
                  key={meeting.id}
                  className="bg-white rounded border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md/5 transition-all p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group cursor-pointer"
                  onClick={() => onSelectMeeting(meeting)}
                  id={`meeting-card-${meeting.id}`}
                >
                  <div className="flex-grow space-y-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <h3 className="text-base md:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {meeting.title}
                      </h3>
                      {meeting.audioBlob && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          <Play className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                          Audio Recording
                        </span>
                      )}
                    </div>

                    {/* Summary Snippet */}
                    {meeting.notes?.summary && (
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed pr-4">
                        {meeting.notes.summary}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(meeting.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDuration(meeting.duration)}
                      </span>
                      
                      {/* Action items counter */}
                      {meeting.notes?.actionItems && meeting.notes.actionItems.length > 0 && (
                        <span className="flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          {meeting.notes.actionItems.filter(i => i.completed).length}/{meeting.notes.actionItems.length} Actions Done
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions / Delete */}
                  <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200">
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.notes?.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded">
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
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Delete Meeting"
                        id={`delete-meeting-btn-${meeting.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all hidden md:block" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" id="delete-modal-overlay">
          <div className="bg-white rounded border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-6" id="delete-modal">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Delete Meeting Notes?</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to delete this meeting? This action is permanent and cannot be undone. All transcripts, recordings, and generated notes will be lost.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3" id="delete-modal-actions">
              <button 
                onClick={() => setMeetingToDelete(null)}
                className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded transition-all"
                id="cancel-delete-modal-btn"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteMeeting(meetingToDelete);
                  setMeetingToDelete(null);
                }}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded shadow-sm transition-all"
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
