import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    case 'high': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'medium': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'low': return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'in_progress': return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
    case 'pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'cancelled': return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
  }
}

export function getMemoryTypeIcon(type: string): string {
  switch (type) {
    case 'preference': return '💡';
    case 'fact': return '📚';
    case 'goal': return '🎯';
    case 'note': return '📝';
    default: return '💭';
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
