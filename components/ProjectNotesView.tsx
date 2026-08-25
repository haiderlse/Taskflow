import React, { useState } from 'react';
import { Project, User, Task } from '../types';
import { 
  PlusIcon, 
  NoteIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  TagIcon, 
  CalendarIcon 
} from './icons';

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: 'Meeting Notes' | 'Architecture Spec' | 'Release Notes' | 'Sprint Retro' | 'General';
  authorId: string;
  updatedAt: Date;
  pinned: boolean;
}

interface ProjectNotesViewProps {
  project: Project;
  currentUser?: User;
  users: User[];
  tasks?: Task[];
}

export const ProjectNotesView: React.FC<ProjectNotesViewProps> = ({
  project,
  currentUser,
  users,
  tasks = [],
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([
    {
      id: 'note-1',
      title: `${project.name} - Project Kickoff & Objectives`,
      content: `## Project Vision & Scope\n\nThis project aims to deliver the strategic milestones for ${project.name}.\n\n### Key Deliverables:\n- Complete dependency alignment\n- Set up daily async standups\n- Finalize SLA and completion criteria\n\n### Architecture & Implementation Guidelines:\nEnsure all pull requests include unit tests and dependency verification before merging into staging.`,
      category: 'Meeting Notes',
      authorId: currentUser?.uid || 'user-1',
      updatedAt: new Date(),
      pinned: true,
    },
    {
      id: 'note-2',
      title: 'Sprint Retrospective & Action Items',
      content: `## What went well:\n- Dependency graph enabled team to unblock frontend tasks 2 days ahead of schedule.\n- Accurate time estimates resulted in 92% SLA predictability.\n\n## What could improve:\n- Reduce concurrent WIP in "In Progress" column to prevent context switching.\n- Automate QA review triggers.`,
      category: 'Sprint Retro',
      authorId: currentUser?.uid || 'user-1',
      updatedAt: new Date(Date.now() - 86400000 * 2),
      pinned: false,
    },
    {
      id: 'note-3',
      title: 'Technical Specs & Data Flow',
      content: `## System Architecture\n\n- Frontend: React + TypeScript + Tailwind CSS\n- State Management: Optimistic update pipeline with offline fallback\n- Graph Engine: D3 Directed Acyclic Graph layout with topological sorting`,
      category: 'Architecture Spec',
      authorId: currentUser?.uid || 'user-1',
      updatedAt: new Date(Date.now() - 86400000 * 4),
      pinned: false,
    }
  ]);

  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSavedToast, setIsSavedToast] = useState(false);

  const selectedNote = notes.find(n => n.id === selectedNoteId) || notes[0];

  const handleUpdateNote = (field: keyof NoteItem, value: any) => {
    if (!selectedNote) return;
    setNotes(prev => prev.map(n => {
      if (n.id === selectedNote.id) {
        return { ...n, [field]: value, updatedAt: new Date() };
      }
      return n;
    }));
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 1500);
  };

  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '## New Section\n\nStart writing notes, specs, or action items here...',
      category: 'General',
      authorId: currentUser?.uid || 'user-1',
      updatedAt: new Date(),
      pinned: false,
    };
    setNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);
  };

  const handleDeleteNote = (id: string) => {
    const remaining = notes.filter(n => n.id !== id);
    setNotes(remaining);
    if (selectedNoteId === id && remaining.length > 0) {
      setSelectedNoteId(remaining[0].id);
    }
  };

  const filteredNotes = notes.filter(n => {
    const matchQ = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'all' || n.category === selectedCategory;
    return matchQ && matchCat;
  });

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Notes Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Project Docs & Notes</h3>
            <span className="text-xs text-gray-400">{notes.length} document{notes.length === 1 ? '' : 's'}</span>
          </div>
          <button
            onClick={handleCreateNote}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-3 border-b border-gray-100 space-y-2 bg-slate-50">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full text-xs px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium"
          >
            <option value="all">All Categories</option>
            <option value="Meeting Notes">Meeting Notes</option>
            <option value="Architecture Spec">Architecture Spec</option>
            <option value="Release Notes">Release Notes</option>
            <option value="Sprint Retro">Sprint Retro</option>
            <option value="General">General</option>
          </select>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1">
          {filteredNotes.map(note => {
            const isSelected = note.id === selectedNote?.id;

            return (
              <div
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-blue-50/80 border border-blue-200 shadow-xs' 
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <h4 className={`text-xs font-bold truncate flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {note.title || 'Untitled'}
                  </h4>
                  {note.pinned && <span className="text-xs text-amber-500">📌</span>}
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">
                  {note.content.replace(/#|\*|-/g, '')}
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">
                    {note.category}
                  </span>
                  <span>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note Editor Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedNote ? (
          <>
            {/* Editor Top Bar */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-3 flex-1 mr-4">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={e => handleUpdateNote('title', e.target.value)}
                  placeholder="Note title..."
                  className="text-base font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 w-full"
                />
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <select
                  value={selectedNote.category}
                  onChange={e => handleUpdateNote('category', e.target.value)}
                  className="text-xs px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                  <option value="Meeting Notes">Meeting Notes</option>
                  <option value="Architecture Spec">Architecture Spec</option>
                  <option value="Release Notes">Release Notes</option>
                  <option value="Sprint Retro">Sprint Retro</option>
                  <option value="General">General</option>
                </select>

                <button
                  onClick={() => handleUpdateNote('pinned', !selectedNote.pinned)}
                  className={`p-1.5 rounded-lg border text-xs ${
                    selectedNote.pinned ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-300 text-gray-500'
                  }`}
                  title={selectedNote.pinned ? 'Unpin Note' : 'Pin Note'}
                >
                  📌
                </button>

                <button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                  title="Delete Note"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>

                {isSavedToast && (
                  <span className="text-xs text-emerald-600 font-semibold px-2 animate-in fade-in">
                    ✓ Saved
                  </span>
                )}
              </div>
            </div>

            {/* Note Markdown Text Area */}
            <div className="flex-1 p-6 overflow-y-auto">
              <textarea
                value={selectedNote.content}
                onChange={e => handleUpdateNote('content', e.target.value)}
                placeholder="Write markdown formatted content here..."
                className="w-full h-full text-sm text-gray-800 font-mono leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 space-y-3">
            <NoteIcon className="w-12 h-12 text-gray-300" />
            <p className="text-sm font-medium">No note selected</p>
            <button
              onClick={handleCreateNote}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Create Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectNotesView;
