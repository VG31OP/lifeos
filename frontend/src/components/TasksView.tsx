'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Flag,
  Calendar,
  X,
  ListTodo,
  Check,
} from 'lucide-react';
import { useTaskStore } from '@/store';
import { api } from '@/lib/api';
import { Task } from '@/types';
import { formatDate, formatRelativeTime, getPriorityColor, getStatusColor, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
const priorityOptions = ['low', 'medium', 'high', 'urgent'] as const;

export function TasksView() {
  const { tasks, summary, isLoading, setTasks, addTask, updateTask, removeTask, setSummary, setLoading } = useTaskStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'due_date' | 'priority'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formStatus, setFormStatus] = useState<'pending' | 'in_progress' | 'completed' | 'cancelled'>('pending');
  const [formDueDate, setFormDueDate] = useState('');

  // Load tasks on mount and when filter criteria change
  useEffect(() => {
    loadTasks();
  }, [filterStatus, filterPriority]);

  const loadTasks = async (filters: { status: string; priority: string } = { status: filterStatus, priority: filterPriority }) => {
    setLoading(true);
    try {
      const [tasksData, summaryData] = await Promise.all([
        api.getTasks({
          status: filterStatus !== 'all' ? filterStatus : undefined,
          priority: filterPriority !== 'all' ? filterPriority : undefined,
        }),
        api.getTaskSummary(),
      ]);
      setTasks(tasksData);
      setSummary(summaryData);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      if (editingTask) {
        const updated = await api.updateTask(editingTask.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          priority: formPriority,
          status: formStatus,
          due_date: formDueDate || undefined,
        });
        updateTask(updated.id, updated);
        const summaryData = await api.getTaskSummary();
        setSummary(summaryData);
        toast.success('Task updated');
      } else {
        const created = await api.createTask({
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          priority: formPriority,
          status: formStatus,
          due_date: formDueDate || undefined,
        });
        addTask(created);
        const summaryData = await api.getTaskSummary();
        setSummary(summaryData);
        toast.success('Task created');
      }
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    setShowForm(true);
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      removeTask(taskId);
      const summaryData = await api.getTaskSummary();
      setSummary(summaryData);
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleStatusChange = async (task: Task, newStatus: Task['status']) => {
    try {
      const updated = await api.updateTask(task.id, { status: newStatus });
      updateTask(updated.id, updated);
      const summaryData = await api.getTaskSummary();
      setSummary(summaryData);
      toast.success(newStatus === 'completed' ? 'Task marked completed' : 'Task status updated');
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormStatus('pending');
    setFormDueDate('');
    setShowForm(false);
  };

  const filteredTasks = tasks
    .filter(task => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'due_date':
          aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority];
          bVal = priorityOrder[b.priority];
          break;
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const stats = [
    { label: 'Total', value: summary?.total || 0, color: 'text-zinc-700 dark:text-zinc-300' },
    { label: 'Pending', value: summary?.pending || 0, color: 'text-amber-500 dark:text-amber-400' },
    { label: 'In Progress', value: summary?.in_progress || 0, color: 'text-teal-500 dark:text-teal-400' },
    { label: 'Completed', value: summary?.completed || 0, color: 'text-emerald-500 dark:text-emerald-400' },
  ];

  return (
    <div className="flex-1 flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary-500" />
            <span>Tasks & Action Items</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Track, prioritize, and manage actions created manually or by LifeOS AI
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-xs py-2 px-3.5 flex items-center self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Task
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className={`text-2xl font-bold font-mono tracking-tight ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks by title or details..."
              className="input pl-9 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input text-xs w-auto py-1.5"
            >
              <option value="all">All Status</option>
              {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="input text-xs w-auto py-1.5"
            >
              <option value="all">All Priorities</option>
              {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as any);
                setSortOrder(order as any);
              }}
              className="input text-xs w-auto py-1.5"
            >
              <option value="created_at-desc">Newest</option>
              <option value="created_at-asc">Oldest</option>
              <option value="due_date-asc">Due Date (Soonest)</option>
              <option value="priority-desc">Priority (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task Cards List */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-400 dark:text-zinc-500 card">
            <CheckCircle className="w-10 h-10 mb-2.5 opacity-40 text-primary-500" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No tasks match your criteria</p>
            <p className="text-xs text-zinc-500 mt-1">Create a new task above or ask LifeOS to schedule one in chat</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {/* Task Modal (New & Edit) */}
      {(showForm || editingTask) && (
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
                {editingTask ? 'Edit Task' : 'New Task'}
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
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. File Q3 tax return"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="input text-sm min-h-[72px] resize-y"
                  placeholder="Additional context or checklist..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="input text-sm"
                  >
                    {priorityOptions.map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="input text-sm"
                  >
                    {statusOptions.map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary text-xs flex-1 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs flex-1 py-2"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (task: Task, status: Task['status']) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const isCompleted = task.status === 'completed';

  return (
    <div
      onClick={() => onEdit(task)}
      className="card p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        {/* Quick Checkbox button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task, isCompleted ? 'pending' : 'completed');
          }}
          className={cn(
            'mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all border flex-shrink-0',
            isCompleted
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 bg-transparent'
          )}
          title={isCompleted ? 'Mark pending' : 'Mark complete'}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                'text-sm font-medium text-zinc-900 dark:text-white truncate',
                isCompleted && 'line-through text-zinc-400 dark:text-zinc-500'
              )}
            >
              {task.title}
            </h4>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {task.due_date && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-mono',
                    new Date(task.due_date) < new Date() && !isCompleted
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-zinc-100 dark:bg-dark-800 text-zinc-600 dark:text-zinc-400'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold border',
                  getPriorityColor(task.priority)
                )}
              >
                {task.priority}
              </span>
              <span
                className={cn(
                  'text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold border',
                  getStatusColor(task.status)
                )}
              >
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {task.description && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400">
            <span>Created {formatRelativeTime(task.created_at)}</span>
            {task.completed_at && (
              <>
                <span>•</span>
                <span className="text-emerald-500">Done {formatRelativeTime(task.completed_at)}</span>
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
                  onEdit(task);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-dark-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-200"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Task
              </button>
              <button
                onClick={() => {
                  onDelete(task.id);
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
