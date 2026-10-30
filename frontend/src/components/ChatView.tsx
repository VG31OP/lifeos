'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Loader2, ChevronLeft, ChevronRight, Trash2, MoreHorizontal, Copy, Check, X, MessageSquare, Plus } from 'lucide-react';
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
    updateMessage,
    setLoading,
    clearCurrentConversation,
  } = useChatStore();
  const { tasks, setTasks } = useTaskStore();
  const { memories, setMemories } = useMemoryStore();
  const { documents, setDocuments } = useDocumentStore();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [latestExecutionLogs, setLatestExecutionLogs] = useState<ExecutionLog[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage = input;
    setInput('');
    setIsSending(true);
    setLoading(true);
    setLatestExecutionLogs([]);

    try {
      const response = await api.sendMessage({
        message: userMessage,
        conversation_id: currentConversation?.id,
      });

      const [convs, conversationMessages] = await Promise.all([
        api.getConversations(),
        api.getConversationMessages(response.conversation_id),
      ]);
      setConversations(convs);
      setCurrentConversation(convs.find(c => c.id === response.conversation_id) || {
        id: response.conversation_id,
        title: 'New Conversation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setMessages(conversationMessages);
      setLatestExecutionLogs(response.execution_logs || []);

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
      toast.error(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setIsSending(false);
      setLoading(false);
    }
  };

  const handleConversationClick = async (conv: any) => {
    setShowConversations(false);
    setLoading(true);
    try {
      const msgs = await api.getConversationMessages(conv.id);
      setMessages(msgs);
      setCurrentConversation(conv);
      setLatestExecutionLogs([]);
    } catch (error) {
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: number) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await api.deleteConversation(convId);
      const convs = await api.getConversations();
      setConversations(convs);
      if (currentConversation?.id === convId) {
        clearCurrentConversation();
        setLatestExecutionLogs([]);
      }
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error('Failed to delete conversation');
    }
  };

  const handleNewChat = () => {
    clearCurrentConversation();
    setLatestExecutionLogs([]);
    setInput('');
  };

  if (!currentConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6">
          <MessageSquare className="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to LifeOS</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
          Start a new conversation to begin. I can help you manage tasks, remember preferences,
          analyze documents, and execute multi-step workflows.
        </p>
        <form onSubmit={handleSend} className="w-full max-w-2xl">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message LifeOS..."
              className="flex-1 input resize-none min-h-[44px] max-h-48"
              rows={1}
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button type="submit" disabled={!input.trim() || isSending} className="btn-primary p-2 disabled:opacity-50" aria-label="Send message">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
        <button onClick={handleNewChat} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Conversation
        </button>
        {conversations.length > 0 && (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            Or select a previous conversation from the sidebar
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
      {/* Conversation header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConversations(!showConversations)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {currentConversation.title || 'Untitled Conversation'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(currentConversation.updated_at)}
            </p>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          className="btn-ghost p-2"
          title="New conversation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
              conversation_id: currentConversation.id,
              role: 'assistant',
              content: '',
              created_at: new Date().toISOString(),
            }}
            isLoading={true}
          />
        )}
        {latestExecutionLogs.map((log) => (
          <ExecutionLogDisplay key={log.id} log={log} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Tool execution indicator */}
      {isLoading && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-900/50">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="btn-ghost p-2"
            disabled
            title="Attach file (coming soon)"
          >
            <Paperclip className="w-5 h-5 text-gray-400" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message LifeOS..."
            className="flex-1 input resize-none min-h-[44px] max-h-48"
            rows={1}
            disabled={isSending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="btn-primary p-2 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>

      {/* Conversations sidebar on mobile */}
      {showConversations && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConversations(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-dark-900 border-r border-gray-200 dark:border-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-medium">Conversations</h3>
              <button onClick={() => setShowConversations(false)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentConversation?.id === conv.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <p className="font-medium truncate">{conv.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {formatRelativeTime(conv.updated_at)}
                  </p>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No conversations yet
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

  if (message.role === 'tool') return null;

  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser
            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        )}
      >
        {isUser ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'max-w-[85%] rounded-2xl p-4',
            isUser
              ? 'bg-primary-600 text-white rounded-tr-none'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-none'
          )}
        >
          {message.content ? (
            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
              {message.content}
            </ReactMarkdown>
          ) : isLoading && (
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-current/50 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-current/50 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-current/50 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* Tool calls */}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.tool_calls.map((tc: ToolCall, idx: number) => (
                <ToolCallDisplay
                  key={`${tc.id}-${idx}`}
                  toolCall={tc}
                  onToggle={() => setShowToolDetails(prev => ({ ...prev, [tc.id]: !prev[tc.id] }))}
                  isOpen={showToolDetails[tc.id] || false}
                />
              ))}
            </div>
          )}

          {/* Execution logs */}
          {/* These would be passed separately in a real implementation */}
        </div>
        <p className={cn('text-xs mt-1', isUser ? 'text-right text-primary-100' : 'text-gray-500 dark:text-gray-400')}>
          {formatRelativeTime(message.created_at)}
        </p>
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
      default: return '🔧';
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-lg">{getToolIcon(toolCall.name)}</span>
        <span className="font-medium text-gray-900 dark:text-white capitalize">
          {toolCall.name.replace('_', ' ')}
        </span>
        <span className="flex-1" />
        <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-90')} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-2 rounded bg-gray-100 dark:bg-gray-800">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ExecutionLogDisplay({ log }: { log: ExecutionLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className={cn('w-2 h-2 rounded-full', log.success ? 'bg-green-500' : 'bg-red-500')} />
        <span className="font-medium text-gray-900 dark:text-white capitalize">
          {log.tool_name?.replace('_', ' ') || 'Execution'}
        </span>
        <span className="flex-1" />
        <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
          {log.tool_input && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Input</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-2 rounded bg-gray-100 dark:bg-gray-800">
                {JSON.stringify(log.tool_input, null, 2)}
              </pre>
            </div>
          )}
          {log.tool_output && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Output</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-2 rounded bg-gray-100 dark:bg-gray-800">
                {JSON.stringify(log.tool_output, null, 2)}
              </pre>
            </div>
          )}
          {log.error_message && (
            <div className="text-xs text-red-500 p-2 rounded bg-red-50 dark:bg-red-900/20">
              Error: {log.error_message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}