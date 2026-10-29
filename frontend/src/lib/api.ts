import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Token, ChatRequest, ChatResponse, Conversation, Message, Task, TaskCreate, TaskUpdate, TaskSummary, Memory, MemoryCreate, MemoryUpdate, Document, DocumentChunk, ExecutionLog, User } from '@/types';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getToken(): string | null {
    if (!this.accessToken && typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
    }
    return this.accessToken;
  }

  clearToken() {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  // Auth
  async register(email: string, password: string, fullName?: string): Promise<User> {
    const response = await this.client.post('/auth/register', { email, password, full_name: fullName });
    return response.data;
  }

  async login(email: string, password: string): Promise<Token> {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const response = await this.client.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getMe(): Promise<User> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Chat
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.post('/chat', request);
    return response.data;
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await this.client.get('/chat/conversations');
    return response.data;
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    const response = await this.client.get(`/chat/conversations/${conversationId}/messages`);
    return response.data;
  }

  async deleteConversation(conversationId: number): Promise<void> {
    await this.client.delete(`/chat/conversations/${conversationId}`);
  }

  async getExecutionLogs(): Promise<ExecutionLog[]> {
    const response = await this.client.get('/chat/execution-logs');
    return response.data;
  }

  // Tasks
  async createTask(task: TaskCreate): Promise<Task> {
    const response = await this.client.post('/tasks', task);
    return response.data;
  }

  async getTasks(params?: { status?: string; priority?: string; limit?: number }): Promise<Task[]> {
    const response = await this.client.get('/tasks', { params });
    return response.data;
  }

  async getTask(taskId: number): Promise<Task> {
    const response = await this.client.get(`/tasks/${taskId}`);
    return response.data;
  }

  async updateTask(taskId: number, task: TaskUpdate): Promise<Task> {
    const response = await this.client.patch(`/tasks/${taskId}`, task);
    return response.data;
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.client.delete(`/tasks/${taskId}`);
  }

  async getTaskSummary(): Promise<TaskSummary> {
    const response = await this.client.get('/tasks/count/summary');
    return response.data;
  }

  // Memories
  async createMemory(memory: MemoryCreate): Promise<Memory> {
    const response = await this.client.post('/memories', memory);
    return response.data;
  }

  async getMemories(params?: { memory_type?: string; limit?: number }): Promise<Memory[]> {
    const response = await this.client.get('/memories', { params });
    return response.data;
  }

  async searchMemories(query: string, params?: { memory_type?: string; limit?: number }): Promise<Memory[]> {
    const response = await this.client.get('/memories/search', { params: { query, ...params } });
    return response.data;
  }

  async getMemory(memoryId: number): Promise<Memory> {
    const response = await this.client.get(`/memories/${memoryId}`);
    return response.data;
  }

  async updateMemory(memoryId: number, memory: MemoryUpdate): Promise<Memory> {
    const response = await this.client.patch(`/memories/${memoryId}`, memory);
    return response.data;
  }

  async deleteMemory(memoryId: number): Promise<void> {
    await this.client.delete(`/memories/${memoryId}`);
  }

  // Documents
  async uploadDocument(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getDocuments(): Promise<Document[]> {
    const response = await this.client.get('/documents');
    return response.data;
  }

  async getDocument(documentId: number): Promise<Document> {
    const response = await this.client.get(`/documents/${documentId}`);
    return response.data;
  }

  async getDocumentChunks(documentId: number): Promise<DocumentChunk[]> {
    const response = await this.client.get(`/documents/${documentId}/chunks`);
    return response.data;
  }

  async searchDocument(documentId: number, query: string, limit?: number): Promise<DocumentChunk[]> {
    const response = await this.client.get(`/documents/${documentId}/search`, { params: { query, limit } });
    return response.data;
  }

  async deleteDocument(documentId: number): Promise<void> {
    await this.client.delete(`/documents/${documentId}`);
  }
}

export const api = new ApiClient();

// Initialize token on client side
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('access_token');
  if (token) {
    api.setToken(token);
  }
}