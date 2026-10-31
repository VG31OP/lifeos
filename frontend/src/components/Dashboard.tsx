'use client';

import { useEffect, useState } from 'react';
import {
  MessageSquare,
  CheckSquare,
  FileText,
  Brain,
  Activity,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Server,
  User as UserIcon,
  Check,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore, useChatStore, useTaskStore, useMemoryStore, useDocumentStore, useUIStore } from '@/store';
import { api } from '@/lib/api';
import { ChatView } from './ChatView';
import { TasksView } from './TasksView';
import { DocumentsView } from './DocumentsView';
import { MemoriesView } from './MemoriesView';
import { ActivityView } from './ActivityView';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Chat', icon: MessageSquare, tab: 'chat' as const, badge: null },
  { name: 'Tasks', icon: CheckSquare, tab: 'tasks' as const, badge: 'tasks' },
  { name: 'Documents', icon: FileText, tab: 'documents' as const, badge: 'docs' },
  { name: 'Memories', icon: Brain, tab: 'memories' as const, badge: 'mems' },
  { name: 'Activity', icon: Activity, tab: 'activity' as const, badge: null },
];

export function Dashboard() {
  const { user, setUser, logout } = useAuthStore();
  const { sidebarTab, setSidebarTab } = useUIStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);

  const { setConversations, clearCurrentConversation, setLoading: setChatLoading } = useChatStore();
  const { tasks, setTasks, summary, setSummary } = useTaskStore();
  const { memories, setMemories } = useMemoryStore();
  const { documents, setDocuments } = useDocumentStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setChatLoading(true);
        const [convs, tasksData, summaryData, mems, docs, me] = await Promise.all([
          api.getConversations(),
          api.getTasks(),
          api.getTaskSummary(),
          api.getMemories(),
          api.getDocuments(),
          api.getMe(),
        ]);
        setConversations(convs);
        setTasks(tasksData);
        setSummary(summaryData);
        setMemories(mems);
        setDocuments(docs);
        setUser(me);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setChatLoading(false);
      }
    };
    loadData();
  }, [setConversations, setTasks, setSummary, setMemories, setDocuments, setChatLoading, setUser]);

  const handleLogout = () => {
    api.clearToken();
    logout();
    toast.success('Logged out successfully');
  };

  const handleNewConversation = () => {
    clearCurrentConversation();
    setSidebarTab('chat');
  };

  const toggleMemoryConsent = async () => {
    if (!user) return;
    setIsUpdatingConsent(true);
    const newConsent = !user.memory_consent;
    try {
      const updated = await api.updateMe({ memory_consent: newConsent });
      setUser(updated);
      toast.success(newConsent ? 'Autonomous memory enabled' : 'Autonomous memory disabled');
    } catch (error: any) {
      toast.error('Failed to update memory consent');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const toggleDarkMode = () => {
    const current = resolvedTheme || theme || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  const isDarkMode = mounted && (resolvedTheme === 'dark' || (!resolvedTheme && theme === 'dark'));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-900 border-r border-zinc-200 dark:border-zinc-800/80 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-sm shadow-primary-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">LifeOS</span>
              <span className="ml-1.5 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-dark-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                v2.0
              </span>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-dark-800"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick New Chat Action */}
        <div className="p-3">
          <button
            onClick={() => {
              handleNewConversation();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => {
            const isActive = sidebarTab === item.tab;
            let countBadge: number | null = null;
            if (item.badge === 'tasks') countBadge = summary?.pending || tasks.filter(t => t.status !== 'completed').length || null;
            if (item.badge === 'docs') countBadge = documents.length || null;
            if (item.badge === 'mems') countBadge = memories.length || null;

            return (
              <button
                key={item.name}
                onClick={() => {
                  setSidebarTab(item.tab);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-400 dark:text-zinc-500')} />
                  <span className="truncate">{item.name}</span>
                </div>
                {countBadge !== null && countBadge > 0 && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-mono text-[11px]',
                      isActive
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/60 dark:text-primary-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-dark-800 dark:text-zinc-400'
                    )}
                  >
                    {countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Memory Consent Quick Indicator */}
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200/80 dark:border-zinc-800/60 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', user?.memory_consent ? 'bg-primary-500 animate-pulse' : 'bg-zinc-400')} />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Auto Memory</span>
            </div>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                user?.memory_consent
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'bg-zinc-100 dark:bg-dark-800 text-zinc-500'
              )}
            >
              {user?.memory_consent ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-800/60 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary-500/15 text-primary-700 dark:text-primary-300 flex items-center justify-center font-semibold text-xs border border-primary-500/20">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                {user?.full_name || 'Personal Account'}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-dark-700"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between h-full px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-dark-800"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span className="capitalize">{sidebarTab}</span>
                <span>/</span>
                <span className="text-zinc-900 dark:text-white capitalize">Workspace</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewConversation}
                className="btn-secondary hidden sm:flex text-xs py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
                New Chat
              </button>

              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-dark-800 transition-colors"
                title="Open Settings"
                aria-label="Open Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-dark-800 transition-colors"
                aria-label="Toggle theme"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-zinc-600" />}
              </button>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-dark-800 transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Tab View Container */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {sidebarTab === 'chat' && <ChatView />}
          {sidebarTab === 'tasks' && <TasksView />}
          {sidebarTab === 'documents' && <DocumentsView />}
          {sidebarTab === 'memories' && <MemoriesView />}
          {sidebarTab === 'activity' && <ActivityView />}
        </main>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-white dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-zinc-900 dark:text-white">Settings & Preferences</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-dark-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Account section */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Account</h4>
                <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                      {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{user?.full_name || 'Personal User'}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{user?.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              </div>

              {/* Autonomous Memory Consent */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Privacy & Autonomous Agent</h4>
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {user?.memory_consent ? (
                        <ShieldCheck className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">Autonomous Memory Storage</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                          Allow LifeOS AI to autonomously extract and remember key preferences, facts, and goals from chats without requesting permission every single time.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleMemoryConsent}
                      disabled={isUpdatingConsent}
                      className={cn(
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        user?.memory_consent ? 'bg-primary-600' : 'bg-zinc-300 dark:bg-dark-700'
                      )}
                      role="switch"
                      aria-checked={user?.memory_consent}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          user?.memory_consent ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* System Diagnostics */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">System Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Server className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium text-zinc-900 dark:text-white">FastAPI Core</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">127.0.0.1:8000 (Online)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="w-4 h-4 text-primary-500" />
                      <span className="text-xs font-medium text-zinc-900 dark:text-white">AI Engine</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">Dual-Engine (Active)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-zinc-50 dark:bg-dark-950/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
