/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  
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
  const [editTags, setEditTags] = useState<string[]>(meeting.notes?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Update states when the active meeting changes
  useEffect(() => {
    setEditTitle(meeting.title);
    setEditSummary(meeting.notes?.summary || '');
    setEditTranscript(meeting.transcript || '');
    setEditTags(meeting.notes?.tags || []);
    setNewTagInput('');
  }, [meeting]);

  // Tag modifications
  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTag = newTagInput.trim();
    if (cleanTag && !editTags.includes(cleanTag)) {
      setEditTags([...editTags, cleanTag]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
  };

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
        title: editTitle,
        summary: editSummary,
        tags: editTags
      } : {
        title: editTitle,
        summary: editSummary,
        keyPoints: [],
        decisions: [],
        actionItems: [],
        tags: editTags
      }
    };
    onUpdateMeeting(updatedMeeting);
    setIsEditing(false);
  };

  // Reset edits when canceling
  const handleCancelEdits = () => {
    setEditTitle(meeting.title);
    setEditSummary(meeting.notes?.summary || '');
    setEditTranscript(meeting.transcript || '');
    setEditTags(meeting.notes?.tags || []);
    setNewTagInput('');
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

  // Export structured notes to plaintext (.txt) file
  const handleExportText = () => {
    if (!meeting.notes) return;
    const { title, summary, keyPoints, decisions, actionItems, tags } = meeting.notes;
    
    let txtContent = `==================================================\n`;
    txtContent += `MEETING NOTES: ${editTitle.toUpperCase()}\n`;
    txtContent += `==================================================\n`;
    txtContent += `Date: ${new Date(meeting.date).toLocaleString()}\n`;
    txtContent += `Duration: ${formatDuration(meeting.duration)}\n`;
    if (tags && tags.length > 0) {
      txtContent += `Tags: ${tags.join(', ')}\n`;
    }
    txtContent += `\n`;
    
    txtContent += `EXECUTIVE SUMMARY\n`;
    txtContent += `--------------------------------------------------\n`;
    txtContent += `${summary}\n\n`;
    
    if (keyPoints && keyPoints.length > 0) {
      txtContent += `KEY DISCUSSION POINTS\n`;
      txtContent += `--------------------------------------------------\n`;
      keyPoints.forEach(point => {
        txtContent += `• ${point}\n`;
      });
      txtContent += `\n`;
    }

    if (decisions && decisions.length > 0) {
      txtContent += `DECISIONS MADE\n`;
      txtContent += `--------------------------------------------------\n`;
      decisions.forEach(decision => {
        txtContent += `✔ ${decision}\n`;
      });
      txtContent += `\n`;
    }

    if (actionItems && actionItems.length > 0) {
      txtContent += `ACTION ITEMS CHECKLIST\n`;
      txtContent += `--------------------------------------------------\n`;
      actionItems.forEach(item => {
        txtContent += `[${item.completed ? 'X' : ' '}] ${item.task} (Assignee: ${item.assignee})\n`;
      });
      txtContent += `\n`;
    }

    if (meeting.transcript) {
      txtContent += `MEETING TRANSCRIPT\n`;
      txtContent += `--------------------------------------------------\n`;
      txtContent += `${meeting.transcript}\n`;
    }

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${editTitle.toLowerCase().replace(/\s+/g, '_')}_notes.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export structured notes as a beautifully formatted PDF document
  const handleExportPDF = () => {
    if (!meeting.notes) return;
    const { title, summary, keyPoints, decisions, actionItems, tags } = meeting.notes;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxLineWidth = pageWidth - (margin * 2);

    let y = margin;

    const checkPageOverflow = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addSectionHeader = (text: string) => {
      checkPageOverflow(15);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text(text, margin, y);
      y += 6;
      
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    };

    const addWrappedParagraph = (text: string, fontSize = 10, isItalic = false) => {
      doc.setFont('Helvetica', isItalic ? 'oblique' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(51, 65, 85); // slate-700
      
      const lines = doc.splitTextToSize(text, maxLineWidth);
      const lineHeight = fontSize * 0.45;

      lines.forEach((line: string) => {
        checkPageOverflow(lineHeight + 2);
        doc.text(line, margin, y);
        y += lineHeight;
      });
      y += 4;
    };

    // Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    const titleLines = doc.splitTextToSize(editTitle.toUpperCase(), maxLineWidth);
    titleLines.forEach((line: string) => {
      checkPageOverflow(12);
      doc.text(line, margin, y);
      y += 10;
    });
    y += 2;

    // Metadata Row
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    const metaText = `Date: ${new Date(meeting.date).toLocaleString()}   |   Duration: ${formatDuration(meeting.duration)}`;
    doc.text(metaText, margin, y);
    y += 6;

    if (tags && tags.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.text(`Tags: ${tags.join(', ')}`, margin, y);
      y += 8;
    } else {
      y += 4;
    }

    // Divider
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // 1. Executive Summary
    addSectionHeader('EXECUTIVE SUMMARY');
    addWrappedParagraph(summary || 'No executive summary compiled.');

    // 2. Key Discussion Points
    if (keyPoints && keyPoints.length > 0) {
      addSectionHeader('KEY DISCUSSION POINTS');
      keyPoints.forEach(point => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        
        const bulletText = `•  ${point}`;
        const bulletLines = doc.splitTextToSize(bulletText, maxLineWidth - 4);
        
        bulletLines.forEach((line: string, index: number) => {
          checkPageOverflow(6);
          doc.text(line, margin + (index === 0 ? 0 : 4), y);
          y += 5;
        });
        y += 2;
      });
      y += 4;
    }

    // 3. Decisions Made
    if (decisions && decisions.length > 0) {
      addSectionHeader('DECISIONS MADE');
      decisions.forEach(decision => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        
        const text = `✔  ${decision}`;
        const lines = doc.splitTextToSize(text, maxLineWidth - 4);
        
        lines.forEach((line: string, index: number) => {
          checkPageOverflow(6);
          doc.text(line, margin + (index === 0 ? 0 : 4), y);
          y += 5;
        });
        y += 2;
      });
      y += 4;
    }

    // 4. Action Items Checklist
    if (actionItems && actionItems.length > 0) {
      addSectionHeader('ACTION ITEMS CHECKLIST');
      actionItems.forEach(item => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        
        const statusBox = item.completed ? '[X]' : '[  ]';
        const itemText = `${statusBox}  ${item.task} (Assignee: ${item.assignee})`;
        const lines = doc.splitTextToSize(itemText, maxLineWidth - 4);
        
        lines.forEach((line: string, index: number) => {
          checkPageOverflow(6);
          doc.text(line, margin + (index === 0 ? 0 : 4), y);
          y += 5;
        });
        y += 2;
      });
      y += 4;
    }

    // 5. Full Transcript
    if (meeting.transcript) {
      addSectionHeader('MEETING TRANSCRIPT');
      addWrappedParagraph(meeting.transcript, 9);
    }

    // Save the PDF
    doc.save(`${editTitle.toLowerCase().replace(/\s+/g, '_')}_notes.pdf`);
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
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-bold text-xs mb-6 transition-all group cursor-pointer uppercase tracking-widest select-none"
        id="back-to-list-btn"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Discussions
      </button>

      {/* Meeting Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-6 md:p-8 mb-6 transition-all duration-200" id="header-card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-grow">
            {isEditing ? (
              <input 
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                id="edit-title-input"
              />
            ) : (
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase font-sans" id="details-meeting-title">
                {meeting.title}
              </h1>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 dark:text-slate-500 mt-4 font-mono transition-colors duration-200 animate-fade-in" id="metadata-row">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {new Date(meeting.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                Duration: {formatDuration(meeting.duration)}
              </span>
            </div>

            {/* Display / Edit Tags */}
            {isEditing ? (
              <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xl transition-colors duration-200" id="edit-tags-container">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 select-none">
                  Custom tags
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {editTags.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 pl-2.5 pr-1.5 py-1 rounded-lg"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-indigo-150 dark:hover:bg-indigo-900/60 text-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        id={`remove-tag-btn-${idx}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {editTags.length === 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">No tags yet. Add one below!</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom tag (e.g. 'Work', 'Project X')"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-grow text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-colors duration-200"
                    id="new-tag-input-field"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag()}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all cursor-pointer"
                    id="add-tag-submit-btn"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              meeting.notes?.tags && meeting.notes.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4" id="details-tags">
                  {meeting.notes.tags.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md transition-colors duration-200"
                    >
                      <Tag className="w-3 h-3 text-slate-400" />
                      {tag}
                    </span>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Edit Actions */}
          <div className="flex flex-shrink-0 items-center gap-3">
            {isEditing ? (
              <>
                <button 
                  onClick={handleSaveEdits}
                  className="px-4.5 py-2.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-500/10 transition-all cursor-pointer"
                  id="save-edit-btn"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button 
                  onClick={handleCancelEdits}
                  className="px-4.5 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all cursor-pointer"
                  id="cancel-edit-btn"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-3 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer animate-fade-in"
                  title="Edit Notes"
                  id="start-edit-btn"
                >
                  <Edit3 className="w-4.5 h-4.5" />
                </button>
                {meeting.notes && (
                  <div className="relative" id="export-menu-container">
                    <button 
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="px-3 sm:px-4.5 py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-widest flex items-center gap-2.5 shadow-sm hover:shadow-md/5 transition-all cursor-pointer select-none"
                      title="Export Options"
                      id="export-options-toggle-btn"
                    >
                      <Download className="w-4 h-4" />
                      Export notes
                    </button>
                    
                    <AnimatePresence>
                      {showExportMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowExportMenu(false)} 
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl shadow-xl p-2 z-50 transition-colors duration-200"
                            id="export-dropdown-menu"
                          >
                            <button
                              onClick={() => {
                                handleExportPDF();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                              id="export-pdf-btn"
                            >
                              <FileText className="w-4 h-4 text-rose-500" />
                              Export as PDF (.pdf)
                            </button>
                            <button
                              onClick={() => {
                                handleExportText();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                              id="export-text-btn"
                            >
                              <FileText className="w-4 h-4 text-blue-500" />
                              Export as Plain Text (.txt)
                            </button>
                            <button
                              onClick={() => {
                                handleExportMarkdown();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                              id="export-md-btn"
                            >
                              <FileText className="w-4 h-4 text-emerald-500" />
                              Export as Markdown (.md)
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Custom Audio Player */}
        {audioUrl && (
          <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60" id="audio-player-container">
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate} 
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              className="hidden"
            />
            <div className="flex items-center gap-4 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl p-4.5 border border-indigo-100/50 dark:border-indigo-900/30">
              <button 
                onClick={handlePlayPause}
                className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
                id="audio-play-pause-btn"
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 fill-white text-white" /> : <Play className="w-4.5 h-4.5 fill-white text-white translate-x-[1px]" />}
              </button>

              <div className="flex-grow flex items-center gap-3.5">
                <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400 min-w-[35px] font-bold">
                  {formatAudioTime(currentTime)}
                </span>
                
                <input 
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={currentTime}
                  onChange={handleAudioSeek}
                  className="flex-grow accent-indigo-600 h-1.5 bg-indigo-100/50 dark:bg-slate-800 rounded-lg cursor-pointer"
                  id="audio-progress-bar"
                />

                <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400 min-w-[35px] font-bold">
                  {formatAudioTime(audioDuration)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Tabbed Layout */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden transition-colors duration-200" id="details-tabs-container">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 px-6 pt-4 transition-colors duration-200" id="tab-headers">
          <button 
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-4 pb-4 text-xs font-bold relative transition-all uppercase tracking-wider cursor-pointer ${activeTab === 'notes' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
            id="tab-notes-btn"
          >
            <Sparkles className="w-4 h-4" />
            AI Smart Notes
            {activeTab === 'notes' && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              />
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 pb-4 text-xs font-bold relative transition-all uppercase tracking-wider cursor-pointer ${activeTab === 'transcript' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
            id="tab-transcript-btn"
          >
            <FileText className="w-4 h-4" />
            Full Transcript
            {activeTab === 'transcript' && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
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
                <h3 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2 select-none">
                  <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Executive Summary
                </h3>
                {isEditing ? (
                  <textarea 
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={5}
                    className="w-full text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent leading-relaxed text-sm transition-colors duration-200"
                    id="edit-summary-textarea"
                  />
                ) : (
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-line transition-colors duration-200">
                    {meeting.notes?.summary}
                  </p>
                )}
              </div>

              {/* Grid for Key Points and Decisions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-7 border-t border-slate-200/60 dark:border-slate-800/60" id="notes-grid">
                
                {/* Key Points */}
                <div id="key-points-section">
                  <h3 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-5 flex items-center gap-2 select-none">
                    <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Discussion Points
                  </h3>
                  {meeting.notes?.keyPoints && meeting.notes.keyPoints.length > 0 ? (
                    <ul className="space-y-3.5">
                      {meeting.notes.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex gap-3 items-start text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-2 flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic">No points captured.</p>
                  )}
                </div>

                {/* Decisions Made */}
                <div id="decisions-section">
                  <h3 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-5 flex items-center gap-2 select-none">
                    <CheckCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Decisions Made
                  </h3>
                  {meeting.notes?.decisions && meeting.notes.decisions.length > 0 ? (
                    <ul className="space-y-3">
                      {meeting.notes.decisions.map((decision, idx) => (
                        <li key={idx} className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 flex gap-3.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
                          <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                          {decision}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic">No explicit decisions recorded.</p>
                  )}
                </div>
              </div>

              {/* Action Items Checklist */}
              {meeting.notes?.actionItems && meeting.notes.actionItems.length > 0 && (
                <div className="pt-7 border-t border-slate-200/60 dark:border-slate-800/60" id="action-items-section">
                  <h3 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-5 flex items-center gap-2 select-none">
                    <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Action Items checklist
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {meeting.notes.actionItems.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleToggleActionItem(idx)}
                        className={`flex items-start gap-4 p-4.5 rounded-xl border transition-all cursor-pointer ${item.completed ? 'bg-slate-50/30 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-805/40 text-slate-400 dark:text-slate-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-800'}`}
                      >
                        <button className="flex-shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400 cursor-pointer">
                          {item.completed ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 fill-indigo-50/30 dark:fill-indigo-950/30" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 dark:text-slate-700 hover:text-indigo-500" />
                          )}
                        </button>
                        <div className="flex-grow text-sm leading-relaxed">
                          <span className={item.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300 font-medium'}>
                            {item.task}
                          </span>
                          <span className={`inline-block text-[9px] px-2.5 py-0.5 rounded-lg ml-3.5 font-mono tracking-wider transition-colors duration-200 ${item.completed ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-150/40 dark:border-indigo-900/50 font-bold uppercase'}`}>
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
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="relative flex-grow max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search words in transcript..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                    id="transcript-search-input"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => copyToClipboard(editTranscript)}
                    className="px-4.5 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                    id="copy-transcript-btn"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        Transcript Copied!
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
              <div className="bg-slate-50/40 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-6" id="transcript-text-area">
                {isEditing ? (
                  <textarea 
                    value={editTranscript}
                    onChange={(e) => setEditTranscript(e.target.value)}
                    rows={12}
                    className="w-full text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent leading-relaxed text-sm font-mono transition-colors duration-200"
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
