'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, CheckCircle, Clock, AlertTriangle, Flag, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useTaskStore } from '@/store';
import { api } from '@/lib/api';
import { Task, TaskCreate, TaskUpdate, TaskSummary } from '@/types';
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

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async (filters: { status: string; priority: string } = { status: filterStatus, priority: filterPriority }) => {
    setLoading(true);
    try {
      const [tasksData, summaryData] = await Promise.all([
        api.getTasks({
          status: filters.status !== 'all' ? filters.status : undefined,
          priority: filters.priority !== 'all' ? filters.priority : undefined,
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
          title: formTitle,
          description: formDescription || undefined,
          priority: formPriority,
          status: formStatus,
          due_date: formDueDate || undefined,
        });
        updateTask(updated.id, updated);
        toast.success('Task updated');
      } else {
        const created = await api.createTask({
          title: formTitle,
          description: formDescription || undefined,
          priority: formPriority,
          status: formStatus,
          due_date: formDueDate || undefined,
        });
        addTask(created);
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
    if (!confirm('Delete this task?')) return;
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
    } catch (error) {
      toast.error('Failed to update task');
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
    { label: 'Total', value: summary?.total || 0, color: 'text-gray-600 dark:text-gray-400' },
    { label: 'Pending', value: summary?.pending || 0, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'In Progress', value: summary?.in_progress || 0, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Completed', value: summary?.completed || 0, color: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage your tasks and track progress</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); resetForm(); setShowForm(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="input pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              const status = e.target.value;
              setFilterStatus(status);
              loadTasks({ status, priority: filterPriority });
            }}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => {
              const priority = e.target.value;
              setFilterPriority(priority);
              loadTasks({ status: filterStatus, priority });
            }}
            className="input w-auto"
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
            className="input w-auto"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="due_date-asc">Due Date (Soonest)</option>
            <option value="due_date-desc">Due Date (Latest)</option>
            <option value="priority-desc">Priority (High to Low)</option>
            <option value="priority-asc">Priority (Low to High)</option>
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400">
            <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">No tasks found</p>
            <p className="text-sm">Create your first task or adjust filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task form modal */}
      {(showForm || editingTask) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={resetForm}>
          <div className="bg-white dark:bg-dark-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="input"
                  placeholder="Task title"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="input min-h-[80px] resize-y"
                  placeholder="Task description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="input"
                  >
                    {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="input"
                  >
                    {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">
                  {editingTask ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, onStatusChange }: { task: Task; onEdit: (task: Task) => void; onDelete: (id: number) => void; onStatusChange: (task: Task, status: Task['status']) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  const statusIcons: Record<string, any> = {
    pending: Clock,
    in_progress: AlertTriangle,
    completed: CheckCircle,
    cancelled: Trash2,
  };

  const StatusIcon = statusIcons[task.status] || Clock;

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onStatusChange(task, task.status === 'completed' ? 'pending' : 'completed')}
          className={`mt-1 p-1 rounded transition-colors ${
            task.status === 'completed'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn('font-medium text-gray-900 dark:text-white', task.status === 'completed' && 'line-through text-gray-400 dark:text-gray-500')}>
              {task.title}
            </h4>
            <div className="flex items-center gap-1">
              {task.due_date && (
                <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded', new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400')}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', getPriorityColor(task.priority))}>
                <Flag className="w-3 h-3 mr-1" />
                {task.priority}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', getStatusColor(task.status))}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          {task.description && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{task.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Created {formatRelativeTime(task.created_at)}</span>
            {task.completed_at && (
              <span className="text-green-600 dark:text-green-400">Completed {formatRelativeTime(task.completed_at)}</span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-dark-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-10">
              <button onClick={() => { onEdit(task); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                <Edit className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => { onDelete(task.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}