'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  Code2,
  Terminal,
} from 'lucide-react';
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
    if (toolName === null) return <Clock className="w-4 h-4 text-zinc-400" />;
    return success ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />;
  };

  const getToolLabel = (toolName: string | null) => {
    if (!toolName) return 'Conversation Turn';
    return toolName.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-500" />
            <span>Execution Audit & Telemetry</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time audit log of LLM reasoning, planner steps, and autonomous tool executions
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="btn-secondary text-xs py-2 px-3.5 flex items-center self-start sm:self-auto"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isLoading && 'animate-spin')} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input text-xs w-auto py-1.5"
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={filterTool}
            onChange={(e) => setFilterTool(e.target.value)}
            className="input text-xs w-auto py-1.5"
          >
            <option value="all">All Tools</option>
            {tools.map(tool => (
              <option key={tool} value={tool}>{getToolLabel(tool)}</option>
            ))}
          </select>
          <div className="text-xs text-zinc-400 font-mono self-center sm:ml-auto">
            Showing {filteredLogs.length} of {logs.length} logged runs
          </div>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-400 dark:text-zinc-500 card">
            <Activity className="w-10 h-10 mb-2.5 opacity-40 text-primary-500" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No execution logs found</p>
            <p className="text-xs text-zinc-500 mt-1">Ask LifeOS to perform actions in chat to generate audit events</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <ExecutionLogCard
              key={log.id}
              log={log}
              isExpanded={expandedLogs.has(log.id)}
              onToggle={() => toggleExpand(log.id)}
              getStatusIcon={getStatusIcon}
              getToolLabel={getToolLabel}
            />
          ))
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
    <div className="card p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left focus:outline-none"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-dark-800 border border-zinc-200 dark:border-zinc-700">
          {getStatusIcon(log.success, log.tool_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-white">
              {getToolLabel(log.tool_name)}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {formatRelativeTime(log.created_at)}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
            {log.request ? `Request: ${log.request}` : 'Direct system run'}
          </p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', isExpanded && 'rotate-180')} />
      </button>

      {isExpanded && (
        <div className="mt-3.5 pt-3.5 border-t border-zinc-200 dark:border-zinc-800 space-y-3 font-mono text-xs animate-slide-down">
          {log.planned_steps && log.planned_steps.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-primary-500" />
                <span>Planned Steps</span>
              </p>
              <ol className="space-y-1 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-dark-950 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                {log.planned_steps.map((step: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary-600 dark:text-primary-400">{idx + 1}.</span>
                    <span>{step.description || JSON.stringify(step)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {log.tool_input && (
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-primary-500" />
                <span>Tool Input Payload</span>
              </p>
              <pre className="text-zinc-700 dark:text-zinc-300 overflow-x-auto p-2.5 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800 text-[11px] max-h-56">
                {JSON.stringify(log.tool_input, null, 2)}
              </pre>
            </div>
          )}

          {log.tool_output && (
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Tool Execution Result</span>
              </p>
              <pre className="text-zinc-700 dark:text-zinc-300 overflow-x-auto p-2.5 rounded-lg bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800 text-[11px] max-h-56">
                {JSON.stringify(log.tool_output, null, 2)}
              </pre>
            </div>
          )}

          {log.error_message && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <p className="text-[10px] font-semibold uppercase mb-1">Execution Error</p>
              <p className="text-xs">{log.error_message}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <span>Timestamp: {formatDateTime(log.created_at)}</span>
            {log.conversation_id && <span>Session: #{log.conversation_id}</span>}
            <span className={log.success ? 'text-emerald-500' : 'text-rose-500'}>
              Status: {log.success ? 'COMPLETED' : 'FAILED'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
