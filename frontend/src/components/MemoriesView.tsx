'use client';

import { useState, useEffect } from 'react';
import { Brain, Plus, Search, Trash2, Edit, MoreHorizontal, Loader2, Sparkles, BookOpen, Target, StickyNote } from 'lucide-react';
import { useMemoryStore } from '@/store';
import { api } from '@/lib/api';
import { Memory, MemoryCreate, MemoryUpdate } from '@/types';
import { formatRelativeTime, cn, getMemoryTypeIcon } from '@/lib/utils';
import toast from 'react-hot-toast';

const memoryTypeOptions = ['preference', 'fact', 'goal', 'note'] as const;

export function MemoriesView() {
  const { memories, isLoading, setMemories, addMemory, updateMemory, removeMemory, setLoading } = useMemoryStore();
  const [showForm, setShowForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<'preference' | 'fact' | 'goal' | 'note'>('preference');
  const [formConsented, setFormConsented] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [filterType]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const mems = await api.getMemories({ memory_type: filterType !== 'all' ? filterType : undefined });
      setMemories(mems);
    } catch (error) {
      toast.error('Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.searchMemories(searchQuery, { memory_type: filterType !== 'all' ? filterType : undefined });
      setMemories(results);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;
    if (!formConsented) {
      toast.error('You must consent to save this memory');
      return;
    }

    try {
      if (editingMemory) {
        const updated = await api.updateMemory(editingMemory.id, {
          content: formContent,
          memory_type: formType,
        });
        updateMemory(updated.id, updated);
        toast.success('Memory updated');
      } else {
        const created = await api.createMemory({
          content: formContent,
          memory_type: formType,
          consented: formConsented,
        });
        addMemory(created);
        toast.success('Memory saved');
      }
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save memory');
    }
  };

  const handleEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setFormContent(memory.content);
    setFormType(memory.memory_type);
    setFormConsented(true); // Already consented
    setShowForm(true);
  };

  const handleDelete = async (memoryId: number) => {
    if (!confirm('Delete this memory?')) return;
    try {
      await api.deleteMemory(memoryId);
      removeMemory(memoryId);
      toast.success('Memory deleted');
    } catch (error) {
      toast.error('Failed to delete memory');
    }
  };

  const resetForm = () => {
    setEditingMemory(null);
    setFormContent('');
    setFormType('preference');
    setFormConsented(false);
    setShowForm(false);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Memories</h2>
          <p className="text-gray-500 dark:text-gray-400">Long-term memories and preferences</p>
        </div>
        <button
          onClick={() => { setEditingMemory(null); resetForm(); setShowForm(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Memory
        </button>
      </div>

      {/* Search and filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="input pl-10"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); loadMemories(); }}
            className="input w-auto"
          >
            <option value="all">All Types</option>
            {memoryTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="btn-secondary w-auto"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400">
            <Brain className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">No memories yet</p>
            <p className="text-sm">Add your first memory or preference</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Memory form modal */}
      {(showForm || editingMemory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={resetForm}>
          <div className="bg-white dark:bg-dark-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingMemory ? 'Edit Memory' : 'New Memory'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="input min-h-[100px] resize-y"
                  placeholder="What should I remember?"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="input"
                >
                  <option value="preference">💡 Preference</option>
                  <option value="fact">📚 Fact</option>
                  <option value="goal">🎯 Goal</option>
                  <option value="note">📝 Note</option>
                </select>
              </div>
              {!editingMemory && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">Consent Required</p>
                    <p>By saving this memory, you agree to store this information for future sessions. You can delete it anytime.</p>
                  </div>
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formConsented}
                  onChange={(e) => setFormConsented(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  required
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I consent to saving this as a long-term memory
                </span>
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={!formConsented} className="btn-primary flex-1">
                  {editingMemory ? 'Update' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryCard({ memory, onEdit, onDelete }: { memory: Memory; onEdit: (memory: Memory) => void; onDelete: (id: number) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  const typeIcons: Record<string, any> = {
    preference: Sparkles,
    fact: BookOpen,
    goal: Target,
    note: StickyNote,
  };

  const TypeIcon = typeIcons[memory.memory_type] || Sparkles;

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-900 dark:text-white">{memory.content}</p>
            <div className="flex items-center gap-1">
              <span className={cn('text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400')}>
                {getMemoryTypeIcon(memory.memory_type)} {memory.memory_type}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-dark-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-10">
                    <button onClick={() => { onEdit(memory); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                    <button onClick={() => { onDelete(memory.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{memory.consented ? '✓ Consented' : '⚠ No consent'}</span>
            <span>•</span>
            <span>{formatRelativeTime(memory.created_at)}</span>
            {memory.updated_at !== memory.created_at && (
              <>
                <span>•</span>
                <span>Updated {formatRelativeTime(memory.updated_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}