/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ActionItem {
  task: string;
  assignee: string;
  completed: boolean;
}

export interface MeetingNotes {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  tags: string[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO string
  duration: number; // in seconds
  audioBlob?: Blob; // Recorded audio binary
  transcript?: string;
  notes?: MeetingNotes;
  createdAt: number;
}
