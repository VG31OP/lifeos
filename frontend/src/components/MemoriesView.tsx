'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  Plus,
  Search,
  Trash2,
  Edit,
  MoreHorizontal,
  Loader2,
  Sparkles,
  BookOpen,
  Target,
  StickyNote,
  X,
  ShieldCheck,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { useMemoryStore, useAuthStore } from '@/store';
import { api } from '@/lib/api';
import { Memory } from '@/types';
import { formatRelativeTime, cn, getMemoryTypeIcon } from '@/lib/utils';
import toast from 'react-hot-toast';

const memoryTypeOptions = ['preference', 'fact', 'goal', 'note'] as const;

export function MemoriesView() {
  const { memories, isLoading, setMemories, addMemory, updateMemory, removeMemory, setLoading } = useMemoryStore();
  const { user, setUser } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isTogglingConsent, setIsTogglingConsent] = useState(false);

  // Form state
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<'preference' | 'fact' | 'goal' | 'note'>('preference');
  const [formConsented, setFormConsented] = useState(true);

  useEffect(() => {
    loadMemories();
  }, [filterType]);

  const loadMemories = async (type = filterType) => {
    setLoading(true);
    try {
      const mems = await api.getMemories({
        memory_type: filterType !== 'all' ? filterType : undefined,
      });
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
      const results = await api.searchMemories(searchQuery.trim(), {
        memory_type: filterType !== 'all' ? filterType : undefined,
      });
      setMemories(results);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadMemories();
  };

  const handleToggleConsent = async () => {
    if (!user) return;
    setIsTogglingConsent(true);
    const newConsent = !user.memory_consent;
    try {
      const updated = await api.updateMe({ memory_consent: newConsent });
      setUser(updated);
      toast.success(newConsent ? 'Autonomous memory enabled' : 'Autonomous memory disabled');
    } catch (error) {
      toast.error('Failed to update consent status');
    } finally {
      setIsTogglingConsent(false);
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
          content: formContent.trim(),
          memory_type: formType,
        });
        updateMemory(updated.id, updated);
        toast.success('Memory updated');
      } else {
        const created = await api.createMemory({
          content: formContent.trim(),
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
    setFormConsented(true);
    setShowForm(true);
  };

  const handleDelete = async (memoryId: number) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
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
    setFormConsented(true);
    setShowForm(false);
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary-500" />
            <span>Persistent Memory Bank</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            LifeOS retains preferences, facts, and goals to provide deeply contextual assistance
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-xs py-2 px-3.5 flex items-center self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Memory
        </button>
      </div>

      {/* Autonomous Memory Consent Card */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/70 dark:bg-dark-900/60 border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
            user?.memory_consent
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          )}>
            {user?.memory_consent ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">
                Autonomous Memory Consent: {user?.memory_consent ? 'Active' : 'Disabled'}
              </h4>
              <span className={cn(
                'text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-semibold',
                user?.memory_consent
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-200 dark:bg-dark-800 text-zinc-600 dark:text-zinc-400'
              )}>
                {user?.memory_consent ? 'Granted' : 'Requires Consent'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              {user?.memory_consent
                ? 'The assistant will automatically extract and store important facts from your conversation.'
                : 'The assistant will ask for explicit permission before storing memories.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleConsent}
          disabled={isTogglingConsent}
          className={cn(
            'text-xs py-1.5 px-3 rounded-lg font-medium transition-colors border self-start sm:self-auto flex items-center gap-1.5',
            user?.memory_consent
              ? 'btn-secondary text-zinc-700 dark:text-zinc-300'
              : 'btn-primary'
          )}
        >
          {isTogglingConsent ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : user?.memory_consent ? (
            'Revoke Consent'
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Enable Autonomous Memory
            </>
          )}
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search through stored memories and preferences..."
              className="input pl-9 pr-9 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input text-xs w-auto py-1.5"
          >
            <option value="all">All Types</option>
            {memoryTypeOptions.map(t => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="btn-secondary text-xs w-auto px-4 py-1.5"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
          </button>
        </div>
      </div>

      {/* Memory Cards List */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-400 dark:text-zinc-500 card">
            <Brain className="w-10 h-10 mb-2.5 opacity-40 text-primary-500" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No memories found</p>
            <p className="text-xs text-zinc-500 mt-1">Add your preferences, key facts, or goals above</p>
          </div>
        ) : (
          memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Memory Modal (New & Edit) */}
      {(showForm || editingMemory) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={resetForm}
        >
          <div
            className="bg-white dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {editingMemory ? 'Edit Memory' : 'Store New Memory'}
              </h3>
              <button
                onClick={resetForm}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-dark-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Content *
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="input text-sm min-h-[96px] resize-y"
                  placeholder="e.g. Always generate concise executive bullet points when responding to business inquiries..."
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="input text-sm"
                >
                  <option value="preference">💡 Preference</option>
                  <option value="fact">📚 Fact</option>
                  <option value="goal">🎯 Goal</option>
                  <option value="note">📝 Note</option>
                </select>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConsented}
                    onChange={(e) => setFormConsented(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                    required
                  />
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">Consent to store</span>
                    <p className="mt-0.5">I permit LifeOS to persist this item into long-term vector memory for contextual recall.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary text-xs flex-1 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formConsented}
                  className="btn-primary text-xs flex-1 py-2"
                >
                  {editingMemory ? 'Update Memory' : 'Save to Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  onEdit: (memory: Memory) => void;
  onDelete: (id: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const typeIcons: Record<string, any> = {
    preference: Sparkles,
    fact: BookOpen,
    goal: Target,
    note: StickyNote,
  };

  const TypeIcon = typeIcons[memory.memory_type] || Sparkles;

  return (
    <div
      onClick={() => onEdit(memory)}
      className="card p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-dark-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
          <TypeIcon className="w-4 h-4 text-primary-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-zinc-900 dark:text-zinc-100 font-normal leading-relaxed">
              {memory.content}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-medium bg-zinc-100 dark:bg-dark-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {memory.memory_type}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400">
            <span className={memory.consented ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'}>
              {memory.consented ? '✓ Consented' : '⚠ No Consent'}
            </span>
            <span>•</span>
            <span>Added {formatRelativeTime(memory.created_at)}</span>
            {memory.updated_at !== memory.created_at && (
              <>
                <span>•</span>
                <span>Updated {formatRelativeTime(memory.updated_at)}</span>
              </>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-dark-800"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1 z-20">
              <button
                onClick={() => {
                  onEdit(memory);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-dark-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-200"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  onDelete(memory.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-dark-800 text-rose-600 dark:text-rose-400 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
