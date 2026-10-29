'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Filter, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useExecutionStore } from '@/store';
import { api } from '@/lib/api';
import { ExecutionLog } from '@/types';
import { formatDateTime, formatRelativeTime, cn } from '@/lib/utils';

export function ActivityView() {
  const { logs, isLoading, setLogs, setLoading } = useExecutionStore();
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [filterTool, setFilterTool] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logData = await api.getExecutionLogs();
      setLogs(logData);
    } catch (error) {
      console.error('Failed to load execution logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterStatus === 'success' && !log.success) return false;
    if (filterStatus === 'failed' && log.success) return false;
    if (filterTool !== 'all' && log.tool_name !== filterTool) return false;
    return true;
  });

  const tools = [...new Set(logs.map(log => log.tool_name).filter((t): t is string => Boolean(t)))];

  const toggleExpand = (logId: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const getStatusIcon = (success: boolean | null, toolName: string | null) => {
    if (toolName === null) return <Clock className="w-4 h-4 text-gray-400" />;
    return success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getToolLabel = (toolName: string | null) => {
    if (!toolName) return 'Conversation';
    return toolName.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Activity</h2>
          <p className="text-gray-500 dark:text-gray-400">Execution history and tool calls</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="btn-secondary"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            <option value="success">Success Only</option>
            <option value="failed">Failed Only</option>
          </select>
          <select
            value={filterTool}
            onChange={(e) => setFilterTool(e.target.value)}
            className="input w-auto"
          >
            <option value="all">All Tools</option>
            {tools.map(tool => <option key={tool} value={tool}>{getToolLabel(tool)}</option>)}
          </select>
          <div className="text-sm text-gray-500 dark:text-gray-400 self-center">
            {filteredLogs.length} of {logs.length} entries
          </div>
        </div>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">No activity yet</p>
            <p className="text-sm">Execute tools or have conversations to see activity here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <ExecutionLogCard
                key={log.id}
                log={log}
                isExpanded={expandedLogs.has(log.id)}
                onToggle={() => toggleExpand(log.id)}
                getStatusIcon={getStatusIcon}
                getToolLabel={getToolLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionLogCard({
  log,
  isExpanded,
  onToggle,
  getStatusIcon,
  getToolLabel,
}: {
  log: ExecutionLog;
  isExpanded: boolean;
  onToggle: () => void;
  getStatusIcon: (success: boolean | null, toolName: string | null) => React.ReactNode;
  getToolLabel: (toolName: string | null) => string;
}) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          {getStatusIcon(log.success, log.tool_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-900 dark:text-white">{getToolLabel(log.tool_name)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatRelativeTime(log.created_at)}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {log.request ? `Request: ${log.request.slice(0, 100)}${log.request.length > 100 ? '...' : ''}` : 'No request recorded'}
          </p>
        </div>
        <ChevronDown className={cn('w-5 h-5 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4 animate-slide-down">
          {log.planned_steps && log.planned_steps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Planned Steps</p>
              <ol className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {log.planned_steps.map((step: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary-600 dark:text-primary-400 font-mono">{idx + 1}.</span>
                    <span>{step.description || JSON.stringify(step)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {log.tool_input && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tool Input</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-3 rounded bg-gray-100 dark:bg-gray-800 max-h-64">
                {JSON.stringify(log.tool_input, null, 2)}
              </pre>
            </div>
          )}

          {log.tool_output && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tool Output</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-3 rounded bg-gray-100 dark:bg-gray-800 max-h-64">
                {JSON.stringify(log.tool_output, null, 2)}
              </pre>
            </div>
          )}

          {log.error_message && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Error</p>
              <p className="text-xs text-red-700 dark:text-red-300">{log.error_message}</p>
            </div>
          )}

          {log.verification_result && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Verification</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-3 rounded bg-gray-100 dark:bg-gray-800 max-h-64">
                {JSON.stringify(log.verification_result, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-800">
            <span>Created: {formatDateTime(log.created_at)}</span>
            {log.completed_at && <span>Completed: {formatDateTime(log.completed_at)}</span>}
            {log.conversation_id && <span>Conversation: #{log.conversation_id}</span>}
          </div>
        </div>
      )}
    </div>
  );
}