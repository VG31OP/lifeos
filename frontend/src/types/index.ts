// Type definitions for LifeOS

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Conversation {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  created_at: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  id: string;
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  result: any;
  success: boolean;
  error?: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
}

export interface Memory {
  id: number;
  user_id: number;
  content: string;
  memory_type: 'preference' | 'fact' | 'goal' | 'note';
  consented: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryCreate {
  content: string;
  memory_type?: 'preference' | 'fact' | 'goal' | 'note';
  consented: boolean;
}

export interface MemoryUpdate {
  content?: string;
  memory_type?: 'preference' | 'fact' | 'goal' | 'note';
  consented?: boolean;
}

export interface Document {
  id: number;
  user_id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  content: string | null;
  chunk_count: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  page_number: number | null;
  created_at: string;
}

export interface ExecutionLog {
  id: number;
  user_id: number;
  conversation_id: number | null;
  request: string;
  planned_steps: Record<string, any>[] | null;
  tool_name: string | null;
  tool_input: Record<string, any> | null;
  tool_output: Record<string, any> | null;
  success: boolean;
  error_message: string | null;
  verification_result: Record<string, any> | null;
  created_at: string;
  completed_at: string | null;
}

export interface ChatRequest {
  message: string;
  conversation_id?: number;
}

export interface ChatResponse {
  message: string;
  conversation_id: number;
  tool_calls?: ToolCall[];
  execution_logs?: ExecutionLog[];
}

export interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}