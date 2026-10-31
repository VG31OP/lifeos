'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Paperclip,
  Loader2,
  ChevronRight,
  Trash2,
  Copy,
  Check,
  X,
  MessageSquare,
  Plus,
  Sparkles,
  ArrowUp,
  FileText,
  Clock,
  Code2,
} from 'lucide-react';
import { useChatStore, useTaskStore, useMemoryStore, useDocumentStore } from '@/store';
import { api } from '@/lib/api';
import { Message, ToolCall, ExecutionLog } from '@/types';
import { formatRelativeTime, cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

export function ChatView() {
  const {
    conversations,
    setConversations,
    currentConversation,
    messages,
    isLoading,
    setCurrentConversation,
    setMessages,
    addMessage,
    setLoading,
    clearCurrentConversation,
  } = useChatStore();
  const { setTasks } = useTaskStore();
  const { setMemories } = useMemoryStore();
  const { addDocument, setDocuments } = useDocumentStore();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async (e?: React.FormEvent, directMessage?: string) => {
    if (e) e.preventDefault();
    const textToSend = directMessage || input;
    if (!textToSend.trim() || isSending) return;

    const userMessage = textToSend.trim();
    const tempUserMsg: Message = {
      id: Date.now(),
      conversation_id: currentConversation?.id || 0,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    addMessage(tempUserMsg);
    setInput('');
    setIsSending(true);
    setLoading(true);

    try {
      const response = await api.sendMessage({
        message: userMessage,
        conversation_id: currentConversation?.id,
      });

      // Update conversations list
      const convs = await api.getConversations();
      setConversations(convs);

      // Set active conversation
      const targetConvId = response.conversation_id;
      const targetConv = convs.find(c => c.id === targetConvId) || {
        id: targetConvId,
        title: userMessage.slice(0, 30),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCurrentConversation(targetConv);

      // Load all messages for this conversation to stay in sync
      const msgs = await api.getConversationMessages(targetConvId);
      setMessages(msgs);

      // Refresh data if tools were used
      if (response.tool_calls && response.tool_calls.length > 0) {
        const [tasksData, mems, docs] = await Promise.all([
          api.getTasks(),
          api.getMemories(),
          api.getDocuments(),
        ]);
        setTasks(tasksData);
        setMemories(mems);
        setDocuments(docs);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File exceeds 10MB limit');
      return;
    }

    setIsUploadingFile(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const doc = await api.uploadDocument(file);
      addDocument(doc);
      toast.success(`"${file.name}" uploaded successfully!`, { id: toastId });
      
      // Auto-populate chat prompt
      setInput(`I have uploaded "${doc.original_filename}". Please analyze its contents and give me a summary of key points.`);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to upload document', { id: toastId });
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConversationClick = async (conv: any) => {
    try {
      setLoading(true);
      setCurrentConversation(conv);
      const msgs = await api.getConversationMessages(conv.id);
      setMessages(msgs);
      setShowConversations(false);
    } catch (error) {
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await api.deleteConversation(convId);
      const updated = conversations.filter(c => c.id !== convId);
      setConversations(updated);
      if (currentConversation?.id === convId) {
        clearCurrentConversation();
      }
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error('Failed to delete conversation');
    }
  };

  const handleNewChat = () => {
    clearCurrentConversation();
    setInput('');
  };

  const suggestions = [
    { title: 'Add a new high-priority task', prompt: 'Create a task to review quarterly OKRs with deadline tomorrow at 5pm, high priority' },
    { title: 'Remember my coffee preference', prompt: 'Remember that I prefer single-origin pour-over coffee with oat milk and no sugar' },
    { title: 'List all open tasks', prompt: 'What tasks do I have pending right now?' },
    { title: 'Summarize my documents', prompt: 'Search through my documents and tell me what knowledge files are available' },
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-7rem)] bg-white dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Hidden file input for paperclip */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".txt,.md,.pdf,.docx"
      />

      {/* Chat header */}
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-dark-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {currentConversation?.title || 'LifeOS Assistant'}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Autonomous Agent & Memory Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversations.length > 0 && (
            <button
              onClick={() => setShowConversations(true)}
              className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
              title="View conversation history"
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              <span>History</span>
              <span className="text-[10px] bg-zinc-100 dark:bg-dark-800 px-1.5 py-0.2 rounded font-mono">
                {conversations.length}
              </span>
            </button>
          )}

          <button
            onClick={handleNewChat}
            className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
            title="Start fresh conversation"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-500" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto scrollbar-thin">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4 border border-primary-500/20 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1.5">How can I assist you today?</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
            I can schedule tasks, store persistent memories, search your knowledge base, and execute automated actions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full text-left mb-6">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(undefined, suggestion.prompt)}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-dark-950 hover:border-primary-500/40 hover:bg-zinc-50 dark:hover:bg-dark-800/80 transition-all text-left group"
              >
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {suggestion.title}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-1">
                  "{suggestion.prompt}"
                </div>
              </button>
            ))}
          </div>
          {conversations.length > 0 && (
            <button
              onClick={() => setShowConversations(true)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Or pick from {conversations.length} previous conversation{conversations.length > 1 ? 's' : ''}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLoading={isLoading && messages[messages.length - 1]?.id === message.id}
            />
          ))}
          {isSending && (
            <MessageBubble
              message={{
                id: Date.now(),
                conversation_id: currentConversation?.id || 0,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
              }}
              isLoading={true}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* AI Processing indicator */}
      {isLoading && (
        <div className="px-5 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-dark-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
            <span>LifeOS is analyzing request and executing tools...</span>
          </div>
        </div>
      )}

      {/* Input box */}
      <form onSubmit={(e) => handleSend(e)} className="p-3.5 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-dark-900">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700/80 bg-zinc-50 dark:bg-dark-950 p-2 focus-within:border-primary-500 dark:focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingFile || isSending}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-dark-800 transition-colors disabled:opacity-50"
            title="Attach a document (.txt, .md, .pdf, .docx)"
            aria-label="Attach file"
          >
            {isUploadingFile ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message or instructions (e.g. create a task, recall facts, search knowledge)..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none min-h-[40px] max-h-36 py-2 px-1"
            rows={1}
            disabled={isSending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="p-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-40 disabled:hover:bg-primary-600 transition-colors shadow-sm"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 text-center">
          Press <kbd className="font-mono bg-zinc-100 dark:bg-dark-800 px-1 py-0.5 rounded text-[10px] border border-zinc-200 dark:border-zinc-700">Enter</kbd> to send, <kbd className="font-mono bg-zinc-100 dark:bg-dark-800 px-1 py-0.5 rounded text-[10px] border border-zinc-200 dark:border-zinc-700">Shift + Enter</kbd> for new line
        </p>
      </form>

      {/* History Drawer */}
      {showConversations && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConversations(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-dark-900 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-slide-up">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Chat History</h3>
              </div>
              <button
                onClick={() => setShowConversations(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-dark-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  setShowConversations(false);
                  handleNewChat();
                }}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Start New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                    currentConversation?.id === conv.id
                      ? 'bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-300 font-medium'
                      : 'hover:bg-zinc-100 dark:hover:bg-dark-800 text-zinc-700 dark:text-zinc-300'
                  )}
                  onClick={() => handleConversationClick(conv)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="truncate text-xs font-medium">{conv.title || 'Untitled Conversation'}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {formatRelativeTime(conv.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 hover:bg-zinc-200 dark:hover:bg-dark-700 rounded transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-center text-zinc-400 dark:text-zinc-500 py-10 text-xs">
                  No conversations saved yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isLoading }: { message: Message; isLoading?: boolean }) {
  const [showToolDetails, setShowToolDetails] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  if (message.role === 'tool') return null;

  const isUser = message.role === 'user';

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-0.5',
          isUser
            ? 'bg-primary-600 text-white shadow-sm'
            : 'bg-zinc-200 dark:bg-dark-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
        )}
      >
        {isUser ? 'You' : <Sparkles className="w-3.5 h-3.5 text-primary-500" />}
      </div>

      <div className="flex-1 min-w-0 max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl p-4 text-sm shadow-sm leading-relaxed transition-all',
            isUser
              ? 'bg-primary-600 text-white rounded-tr-none selection:bg-white/30 selection:text-white'
              : 'bg-zinc-100 dark:bg-dark-950 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200 dark:border-zinc-800'
          )}
        >
          {message.content ? (
            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none break-words">
              {message.content}
            </ReactMarkdown>
          ) : isLoading ? (
            <div className="flex items-center gap-1.5 py-1 text-zinc-400">
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : null}

          {/* Tool Calls execution banner */}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                <Code2 className="w-3.5 h-3.5 text-primary-500" />
                <span>Tool Calls Executed ({message.tool_calls.length})</span>
              </div>
              {message.tool_calls.map((tc: ToolCall, idx: number) => (
                <ToolCallDisplay
                  key={`${tc.id || idx}-${idx}`}
                  toolCall={tc}
                  onToggle={() => setShowToolDetails(prev => ({ ...prev, [tc.id || idx]: !prev[tc.id || idx] }))}
                  isOpen={showToolDetails[tc.id || idx] || false}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer info: timestamp & copy */}
        <div className={cn('flex items-center gap-2 mt-1 px-1', isUser ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] text-zinc-400">
            {formatRelativeTime(message.created_at)}
          </span>
          {message.content && !isUser && (
            <button
              onClick={copyText}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall, onToggle, isOpen }: { toolCall: ToolCall; onToggle: () => void; isOpen: boolean }) {
  const getToolIcon = (name: string) => {
    switch (name) {
      case 'create_task': return '➕';
      case 'update_task': return '✏️';
      case 'delete_task': return '🗑️';
      case 'list_tasks': return '📋';
      case 'save_memory': return '🧠';
      case 'search_memories': return '🔍';
      case 'search_documents': return '📄';
      default: return '⚡';
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-dark-900 shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-dark-800 transition-colors"
      >
        <span className="text-sm">{getToolIcon(toolCall.name)}</span>
        <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
          {toolCall.name}
        </span>
        <span className="flex-1" />
        <span className="text-[10px] font-mono text-zinc-400">Args</span>
        <ChevronRight className={cn('w-3.5 h-3.5 text-zinc-400 transition-transform', isOpen && 'rotate-90')} />
      </button>
      {isOpen && (
        <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-dark-950 font-mono text-[11px]">
          <pre className="text-zinc-700 dark:text-zinc-300 overflow-x-auto p-2 rounded bg-zinc-100 dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
