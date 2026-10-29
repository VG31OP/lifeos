import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Conversation, Message, Task, TaskSummary, Memory, Document, ExecutionLog } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: number, updates: Partial<Message>) => void;
  setLoading: (loading: boolean) => void;
  clearCurrentConversation: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations],
  })),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  clearCurrentConversation: () => set({ currentConversation: null, messages: [] }),
}));

interface TaskState {
  tasks: Task[];
  summary: TaskSummary | null;
  isLoading: boolean;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  removeTask: (id: number) => void;
  setSummary: (summary: TaskSummary) => void;
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  summary: null,
  isLoading: false,
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
  })),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

interface MemoryState {
  memories: Memory[];
  isLoading: boolean;
  setMemories: (memories: Memory[]) => void;
  addMemory: (memory: Memory) => void;
  updateMemory: (id: number, updates: Partial<Memory>) => void;
  removeMemory: (id: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  isLoading: false,
  setMemories: (memories) => set({ memories }),
  addMemory: (memory) => set((state) => ({ memories: [memory, ...state.memories] })),
  updateMemory: (id, updates) => set((state) => ({
    memories: state.memories.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  removeMemory: (id) => set((state) => ({
    memories: state.memories.filter((m) => m.id !== id),
  })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  chunks: Record<number, any[]>; // documentId -> chunks
  isLoading: boolean;
  setDocuments: (documents: Document[]) => void;
  addDocument: (document: Document) => void;
  removeDocument: (id: number) => void;
  setCurrentDocument: (document: Document | null) => void;
  setChunks: (documentId: number, chunks: any[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocument: null,
  chunks: {},
  isLoading: false,
  setDocuments: (documents) => set({ documents }),
  addDocument: (document) => set((state) => ({ documents: [document, ...state.documents] })),
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter((d) => d.id !== id),
  })),
  setCurrentDocument: (document) => set({ currentDocument: document }),
  setChunks: (documentId, chunks) => set((state) => ({
    chunks: { ...state.chunks, [documentId]: chunks },
  })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

interface ExecutionState {
  logs: ExecutionLog[];
  isLoading: boolean;
  setLogs: (logs: ExecutionLog[]) => void;
  addLog: (log: ExecutionLog) => void;
  setLoading: (loading: boolean) => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  logs: [],
  isLoading: false,
  setLogs: (logs) => set({ logs }),
  addLog: (log) => set((state) => ({ logs: [log, ...state.logs] })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

interface UIState {
  sidebarOpen: boolean;
  sidebarTab: 'chat' | 'tasks' | 'documents' | 'memories' | 'activity';
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  setSidebarTab: (tab: 'chat' | 'tasks' | 'documents' | 'memories' | 'activity') => void;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarTab: 'chat',
      theme: 'dark',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);