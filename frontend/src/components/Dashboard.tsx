'use client';

import { useEffect, useState } from 'react';
import { LayoutDashboard, MessageSquare, CheckSquare, FileText, Brain, Activity, LogOut, Menu, X, Sun, Moon, Plus, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore, useChatStore, useTaskStore, useMemoryStore, useDocumentStore, useUIStore } from '@/store';
import { api } from '@/lib/api';
import { ChatView } from './ChatView';
import { TasksView } from './TasksView';
import { DocumentsView } from './DocumentsView';
import { MemoriesView } from './MemoriesView';
import { ActivityView } from './ActivityView';
import { formatRelativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Chat', href: '#', icon: MessageSquare, tab: 'chat' as const },
  { name: 'Tasks', href: '#', icon: CheckSquare, tab: 'tasks' as const },
  { name: 'Documents', href: '#', icon: FileText, tab: 'documents' as const },
  { name: 'Memories', href: '#', icon: Brain, tab: 'memories' as const },
  { name: 'Activity', href: '#', icon: Activity, tab: 'activity' as const },
];

export function Dashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { sidebarOpen, sidebarTab, setSidebarTab, toggleSidebar, theme, toggleTheme } = useUIStore();
  const { setConversations, clearCurrentConversation, setLoading: setChatLoading } = useChatStore();
  const { tasks, setTasks, summary, setSummary } = useTaskStore();
  const { memories, setMemories } = useMemoryStore();
  const { documents, setDocuments } = useDocumentStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setChatLoading(true);
        const [convs, tasksData, summaryData, mems, docs] = await Promise.all([
          api.getConversations(),
          api.getTasks(),
          api.getTaskSummary(),
          api.getMemories(),
          api.getDocuments(),
        ]);
        setConversations(convs);
        setTasks(tasksData);
        setSummary(summaryData);
        setMemories(mems);
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load data');
      } finally {
        setChatLoading(false);
      }
    };
    loadData();
  }, [setConversations, setTasks, setSummary, setMemories, setDocuments, setChatLoading]);

  const handleLogout = () => {
    api.clearToken();
    logout();
    toast.success('Logged out successfully');
  };

  const handleNewConversation = async () => {
    clearCurrentConversation();
    setSidebarTab('chat');
  };

  return (
    <div className={`min-h-screen bg-white dark:bg-dark-950 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">LifeOS</h1>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setSidebarTab(item.tab);
                  setMobileMenuOpen(false);
                }}
                className={`w-full ${sidebarTab === item.tab ? 'sidebar-item-active' : 'sidebar-item'} text-left`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.name}
              </button>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <button
                onClick={handleNewConversation}
                className="btn-secondary hidden sm:flex"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {sidebarTab === 'chat' && <ChatView />}
          {sidebarTab === 'tasks' && <TasksView />}
          {sidebarTab === 'documents' && <DocumentsView />}
          {sidebarTab === 'memories' && <MemoriesView />}
          {sidebarTab === 'activity' && <ActivityView />}
        </main>
      </div>
    </div>
  );
}