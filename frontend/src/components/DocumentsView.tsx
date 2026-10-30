'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, Search, Trash2, Eye, MoreHorizontal, Loader2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useDocumentStore } from '@/store';
import { api } from '@/lib/api';
import { Document, DocumentChunk } from '@/types';
import { formatDate, formatRelativeTime, formatDateTime, cn, truncate } from '@/lib/utils';
import toast from 'react-hot-toast';

export function DocumentsView() {
  const { documents, currentDocument, chunks, isLoading, setDocuments, addDocument, removeDocument, setCurrentDocument, setChunks, setLoading } = useDocumentStore();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingChunks, setViewingChunks] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.txt', '.md', '.pdf', '.docx'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(ext)) {
        toast.error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`);
        return;
      }
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Max 10MB');
        return;
      }
      setUploadingFile(file);
      setShowUpload(true);
    }
  };

  const handleUpload = async () => {
    if (!uploadingFile) return;
    setIsUploading(true);
    try {
      const doc = await api.uploadDocument(uploadingFile);
      addDocument(doc);
      toast.success('Document uploaded and processed');
      setShowUpload(false);
      setUploadingFile(null);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    setCurrentDocument(doc);
    setViewingChunks(true);
    try {
      const docChunks = await api.getDocumentChunks(doc.id);
      setChunks(doc.id, docChunks);
    } catch (error) {
      toast.error('Failed to load document chunks');
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm('Delete this document and all its chunks?')) return;
    try {
      await api.deleteDocument(docId);
      removeDocument(docId);
      if (currentDocument?.id === docId) {
        setCurrentDocument(null);
        setViewingChunks(false);
      }
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleSearchDocument = async (docId: number, query: string) => {
    if (!query.trim()) return;
    try {
      const results = await api.searchDocument(docId, query);
      setChunks(docId, results);
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case '.pdf': return '📄';
      case '.docx': return '📝';
      case '.txt': return '📃';
      case '.md': return '📝';
      default: return '📄';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Documents</h2>
          <p className="text-gray-500 dark:text-gray-400">Upload and manage your documents</p>
        </div>
        <label className="btn-primary cursor-pointer">
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
          <input type="file" onChange={handleFileSelect} className="hidden" accept=".txt,.md,.pdf,.docx" />
        </label>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && uploadingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowUpload(false); setUploadingFile(null); }}>
          <div className="bg-white dark:bg-dark-900 rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Upload Document</h3>
              <button onClick={() => { setShowUpload(false); setUploadingFile(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <span className="text-4xl">{getFileIcon('.' + uploadingFile.name.split('.').pop()?.toLowerCase())}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uploadingFile.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{(uploadingFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {isUploading ? 'Uploading and processing document...' : 'Ready to upload'}
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setShowUpload(false); setUploadingFile(null); }}
                  disabled={isUploading}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="btn-primary flex-1"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document chunks view */}
      {viewingChunks && currentDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setViewingChunks(false); setCurrentDocument(null); }}>
          <div className="bg-white dark:bg-dark-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(currentDocument.file_type)}</span>
                <div>
                  <h3 className="font-semibold truncate">{currentDocument.original_filename}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentDocument.chunk_count} chunks • {formatDate(currentDocument.created_at)}
                  </p>
                </div>
              </div>
              <button onClick={() => { setViewingChunks(false); setCurrentDocument(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search within document..."
                  className="input pl-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchDocument(currentDocument.id, e.currentTarget.value);
                    }
                  }}
                />
              </div>
              {chunks[currentDocument.id]?.map((chunk: DocumentChunk) => (
                <div key={chunk.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Chunk {chunk.chunk_index + 1}</span>
                    {chunk.page_number && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">Page {chunk.page_number}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{chunk.content}</p>
                </div>
              ))}
              {(!chunks[currentDocument.id] || chunks[currentDocument.id].length === 0) && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No chunks found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">No documents yet</p>
            <p className="text-sm">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onView={handleViewDocument}
                onDelete={handleDeleteDocument}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentCard({ doc, onView, onDelete }: { doc: Document; onView: (doc: Document) => void; onDelete: (id: number) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case '.pdf': return '📄';
      case '.docx': return '📝';
      case '.txt': return '📃';
      case '.md': return '📝';
      default: return '📄';
    }
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    processing: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    pending: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <span className="text-3xl">{getFileIcon(doc.file_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">{doc.original_filename}</h4>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', statusColors[doc.processing_status] || statusColors.pending)}>
                {doc.processing_status}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-dark-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-10">
                    <button onClick={() => { onView(doc); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                      <Eye className="w-4 h-4" /> View Chunks
                    </button>
                    <button onClick={() => { onDelete(doc.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{doc.chunk_count} chunks</span>
            <span>•</span>
            <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
            <span>•</span>
            <span>{formatRelativeTime(doc.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}