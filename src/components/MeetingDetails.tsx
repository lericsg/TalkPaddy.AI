/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Calendar, Clock, Copy, Check, Download, 
  Search, Play, Pause, Edit3, Save, CheckSquare, Square, 
  Tag, ListChecks, FileText, Sparkles, MessageSquare, CheckCircle 
} from 'lucide-react';
import { Meeting, ActionItem, MeetingNotes } from '../types';

interface MeetingDetailsProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdateMeeting: (updatedMeeting: Meeting) => void;
}

export default function MeetingDetails({ meeting, onBack, onUpdateMeeting }: MeetingDetailsProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript'>('notes');
  const [isCopied, setIsCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Audio Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState(meeting.title);
  const [editSummary, setEditSummary] = useState(meeting.notes?.summary || '');
  const [editTranscript, setEditTranscript] = useState(meeting.transcript || '');

  // Setup Audio Object URL from Blob
  useEffect(() => {
    if (meeting.audioBlob) {
      const url = URL.createObjectURL(meeting.audioBlob);
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [meeting.audioBlob]);

  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Toggle checklist completed state
  const handleToggleActionItem = (index: number) => {
    if (!meeting.notes) return;
    
    const updatedActionItems = [...meeting.notes.actionItems];
    updatedActionItems[index] = {
      ...updatedActionItems[index],
      completed: !updatedActionItems[index].completed
    };

    const updatedMeeting: Meeting = {
      ...meeting,
      notes: {
        ...meeting.notes,
        actionItems: updatedActionItems
      }
    };

    onUpdateMeeting(updatedMeeting);
  };

  // Save edits
  const handleSaveEdits = () => {
    const updatedMeeting: Meeting = {
      ...meeting,
      title: editTitle,
      transcript: editTranscript,
      notes: meeting.notes ? {
        ...meeting.notes,
        summary: editSummary
      } : undefined
    };
    onUpdateMeeting(updatedMeeting);
    setIsEditing(false);
  };

  // Reset edits when canceling
  const handleCancelEdits = () => {
    setEditTitle(meeting.title);
    setEditSummary(meeting.notes?.summary || '');
    setEditTranscript(meeting.transcript || '');
    setIsEditing(false);
  };

  // Export structured notes to markdown file
  const handleExportMarkdown = () => {
    if (!meeting.notes) return;
    const { title, summary, keyPoints, decisions, actionItems, tags } = meeting.notes;
    
    let mdContent = `# Meeting Notes: ${editTitle}\n`;
    mdContent += `*Date: ${new Date(meeting.date).toLocaleString()}*\n`;
    mdContent += `*Duration: ${formatDuration(meeting.duration)}*\n\n`;
    
    mdContent += `## Executive Summary\n${summary}\n\n`;
    
    mdContent += `## Key Discussion Points\n`;
    keyPoints.forEach(point => {
      mdContent += `- ${point}\n`;
    });
    mdContent += `\n`;

    mdContent += `## Decisions Made\n`;
    decisions.forEach(decision => {
      mdContent += `- [x] ${decision}\n`;
    });
    mdContent += `\n`;

    mdContent += `## Action Items\n`;
    actionItems.forEach(item => {
      mdContent += `- [${item.completed ? 'x' : ' '}] ${item.task} (Assignee: ${item.assignee})\n`;
    });
    mdContent += `\n`;

    mdContent += `## Tags\n${tags.map(t => `#${t}`).join(' ')}\n`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${editTitle.toLowerCase().replace(/\s+/g, '_')}_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Audio Player controls
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleAudioSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekValue = parseFloat(e.target.value);
      audioRef.current.currentTime = seekValue;
      setCurrentTime(seekValue);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Helpers
  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Highlight words matching Search Term in transcript
  const getHighlightedText = (text: string, search: string) => {
    if (!search.trim()) return <p className="whitespace-pre-line leading-relaxed text-slate-700">{text}</p>;
    
    const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <p className="whitespace-pre-line leading-relaxed text-slate-700">
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-100 text-yellow-950 px-0.5 rounded font-medium">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </p>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-16" id="details-view">
      {/* Back to history button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 font-semibold text-sm mb-6 transition-all group"
        id="back-to-list-btn"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Meetings
      </button>

      {/* Meeting Header Card */}
      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 md:p-8 mb-6" id="header-card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-grow">
            {isEditing ? (
              <input 
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-2xl md:text-3xl font-bold tracking-tight text-slate-900 bg-slate-50 border border-slate-200 rounded px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent"
                id="edit-title-input"
              />
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 uppercase" id="details-meeting-title">
                {meeting.title}
              </h1>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mt-4 font-mono" id="metadata-row">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {new Date(meeting.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                Duration: {formatDuration(meeting.duration)}
              </span>
            </div>

            {/* Display Tags */}
            {meeting.notes?.tags && meeting.notes.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4" id="details-tags">
                {meeting.notes.tags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded"
                  >
                    <Tag className="w-3 h-3 text-slate-400" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Edit Actions */}
          <div className="flex flex-shrink-0 items-center gap-3">
            {isEditing ? (
              <>
                <button 
                  onClick={handleSaveEdits}
                  className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-1.5 shadow-sm transition-all"
                  id="save-edit-btn"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button 
                  onClick={handleCancelEdits}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded transition-all"
                  id="cancel-edit-btn"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded border border-slate-200 transition-all"
                  title="Edit Notes"
                  id="start-edit-btn"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                {meeting.notes && (
                  <button 
                    onClick={handleExportMarkdown}
                    className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded border border-slate-200 transition-all"
                    title="Export Markdown"
                    id="export-markdown-btn"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Custom Audio Player */}
        {audioUrl && (
          <div className="mt-8 pt-6 border-t border-slate-200" id="audio-player-container">
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate} 
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              className="hidden"
            />
            <div className="flex items-center gap-4 bg-blue-50/50 rounded p-4 border border-blue-100">
              <button 
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all shadow-sm"
                title={isPlaying ? "Pause" : "Play"}
                id="audio-play-pause-btn"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white translate-x-[1px]" />}
              </button>

              <div className="flex-grow flex items-center gap-3">
                <span className="text-xs font-mono text-blue-700 min-w-[35px] font-semibold">
                  {formatAudioTime(currentTime)}
                </span>
                
                <input 
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={currentTime}
                  onChange={handleAudioSeek}
                  className="flex-grow accent-blue-600 h-1.5 bg-blue-100 rounded cursor-pointer"
                  id="audio-progress-bar"
                />

                <span className="text-xs font-mono text-blue-700 min-w-[35px] font-semibold">
                  {formatAudioTime(audioDuration)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Tabbed Layout */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden" id="details-tabs-container">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-4" id="tab-headers">
          <button 
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-4 pb-4 text-sm font-bold relative transition-all ${activeTab === 'notes' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            id="tab-notes-btn"
          >
            <Sparkles className="w-4 h-4" />
            AI Smart Notes
            {activeTab === 'notes' && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded"
              />
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 pb-4 text-sm font-bold relative transition-all ${activeTab === 'transcript' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            id="tab-transcript-btn"
          >
            <FileText className="w-4 h-4" />
            Full Transcript
            {activeTab === 'transcript' && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded"
              />
            )}
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="p-6 md:p-8" id="tab-content-panel">
          {activeTab === 'notes' && (
            <div className="space-y-8" id="notes-tab-content">
              
              {/* Summary Block */}
              <div id="executive-summary-section">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  Executive Summary
                </h3>
                {isEditing ? (
                  <textarea 
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={5}
                    className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded px-4 py-3 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent leading-relaxed text-sm"
                    id="edit-summary-textarea"
                  />
                ) : (
                  <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-line">
                    {meeting.notes?.summary}
                  </p>
                )}
              </div>

              {/* Grid for Key Points and Decisions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-200" id="notes-grid">
                
                {/* Key Points */}
                <div id="key-points-section">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-600" />
                    Key Discussion Points
                  </h3>
                  {meeting.notes?.keyPoints && meeting.notes.keyPoints.length > 0 ? (
                    <ul className="space-y-2.5">
                      {meeting.notes.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex gap-2.5 items-start text-sm text-slate-700 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No key points captured.</p>
                  )}
                </div>

                {/* Decisions Made */}
                <div id="decisions-section">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    Decisions Made
                  </h3>
                  {meeting.notes?.decisions && meeting.notes.decisions.length > 0 ? (
                    <ul className="space-y-3">
                      {meeting.notes.decisions.map((decision, idx) => (
                        <li key={idx} className="bg-slate-50 border border-slate-200 rounded p-3.5 flex gap-3 text-sm text-slate-700 leading-relaxed">
                          <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          {decision}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No explicit decisions recorded.</p>
                  )}
                </div>
              </div>

              {/* Action Items Checklist */}
              {meeting.notes?.actionItems && meeting.notes.actionItems.length > 0 && (
                <div className="pt-6 border-t border-slate-200" id="action-items-section">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-600" />
                    Action Items & Checklists
                  </h3>
                  <div className="space-y-2">
                    {meeting.notes.actionItems.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleToggleActionItem(idx)}
                        className={`flex items-start gap-3.5 p-4 rounded border transition-all cursor-pointer ${item.completed ? 'bg-slate-50/50 border-slate-200 text-slate-400' : 'bg-white border-slate-200 text-slate-800 hover:border-blue-300'}`}
                      >
                        <button className="flex-shrink-0 mt-0.5 text-blue-600">
                          {item.completed ? (
                            <CheckSquare className="w-5 h-5 text-blue-600 fill-blue-50" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400 hover:text-blue-500" />
                          )}
                        </button>
                        <div className="flex-grow text-sm leading-relaxed">
                          <span className={item.completed ? 'line-through text-slate-400' : 'text-slate-700'}>
                            {item.task}
                          </span>
                          <span className={`inline-block text-xs px-2 py-0.5 rounded ml-3 font-mono ${item.completed ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 border border-blue-150 font-bold'}`}>
                            {item.assignee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-6" id="transcript-tab-content">
              {/* Controls bar (Search, Copy) */}
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between pb-4 border-b border-slate-200">
                <div className="relative flex-grow max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search words in transcript..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded pl-9 pr-4 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent"
                    id="transcript-search-input"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => copyToClipboard(editTranscript)}
                    className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded flex items-center gap-1.5 transition-all"
                    id="copy-transcript-btn"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Transcript
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Transcript Display Area */}
              <div className="bg-[#FBFCFD] border border-slate-200 rounded p-6" id="transcript-text-area">
                {isEditing ? (
                  <textarea 
                    value={editTranscript}
                    onChange={(e) => setEditTranscript(e.target.value)}
                    rows={12}
                    className="w-full text-slate-700 bg-white border border-slate-200 rounded px-4 py-3 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent leading-relaxed text-sm font-mono"
                    id="edit-transcript-textarea"
                  />
                ) : (
                  getHighlightedText(meeting.transcript || '', searchTerm)
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
