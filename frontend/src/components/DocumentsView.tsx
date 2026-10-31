'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  Trash2,
  Eye,
  MoreHorizontal,
  Loader2,
  X,
  FileCode,
  FileSpreadsheet,
  File,
  Layers,
} from 'lucide-react';
import { useDocumentStore } from '@/store';
import { api } from '@/lib/api';
import { Document, DocumentChunk } from '@/types';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function DocumentsView() {
  const {
    documents,
    currentDocument,
    chunks,
    isLoading,
    setDocuments,
    addDocument,
    removeDocument,
    setCurrentDocument,
    setChunks,
    setLoading,
  } = useDocumentStore();

  const [showUpload, setShowUpload] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chunkSearchQuery, setChunkSearchQuery] = useState('');
  const [viewingChunks, setViewingChunks] = useState(false);
  const [isSearchingChunks, setIsSearchingChunks] = useState(false);

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
      const allowedTypes = ['.txt', '.md', '.pdf', '.docx'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(ext)) {
        toast.error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Max limit is 10MB');
        return;
      }
      setUploadingFile(file);
      setShowUpload(true);
    }
  };

  const handleUpload = async () => {
    if (!uploadingFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 150);

      const doc = await api.uploadDocument(uploadingFile);
      clearInterval(progressInterval);
      setUploadProgress(100);
      addDocument(doc);
      toast.success('Document uploaded and indexed into knowledge base');
      setShowUpload(false);
      setUploadingFile(null);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    setCurrentDocument(doc);
    setViewingChunks(true);
    setChunkSearchQuery('');
    try {
      const docChunks = await api.getDocumentChunks(doc.id);
      setChunks(doc.id, docChunks);
    } catch (error) {
      toast.error('Failed to load document chunks');
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document and all its indexed chunks?')) return;
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

  const handleSearchDocumentChunks = async (docId: number, query: string) => {
    if (!query.trim()) {
      try {
        const docChunks = await api.getDocumentChunks(docId);
        setChunks(docId, docChunks);
      } catch (error) {
        toast.error('Failed to reload chunks');
      }
      return;
    }

    setIsSearchingChunks(true);
    try {
      const results = await api.searchDocument(docId, query.trim());
      setChunks(docId, results);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsSearchingChunks(false);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <span>Document Knowledge Base</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Uploaded files are chunked, embedded, and queried via semantic RAG
          </p>
        </div>
        <label className="btn-primary text-xs py-2 px-3.5 flex items-center self-start sm:self-auto cursor-pointer">
          <Upload className="w-4 h-4 mr-1.5" />
          <span>Upload Document</span>
          <input
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.md,.pdf,.docx"
          />
        </label>
      </div>

      {/* Search Toolbar */}
      <div className="card p-3 sm:p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name..."
            className="input pl-9 pr-9 text-xs"
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
      </div>

      {/* Document Cards List */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-400 dark:text-zinc-500 card">
            <FileText className="w-10 h-10 mb-2.5 opacity-40 text-primary-500" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No documents in knowledge base</p>
            <p className="text-xs text-zinc-500 mt-1">Upload a TXT, Markdown, or PDF document to enable semantic search</p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onView={handleViewDocument}
              onDelete={handleDeleteDocument}
            />
          ))
        )}
      </div>

      {/* Upload Confirmation Modal */}
      {showUpload && uploadingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => { setShowUpload(false); setUploadingFile(null); }}
        >
          <div
            className="bg-white dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Upload & Index Document</h3>
              <button
                onClick={() => { setShowUpload(false); setUploadingFile(null); }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-dark-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3.5 p-3.5 bg-zinc-50 dark:bg-dark-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <FileText className="w-8 h-8 text-primary-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {uploadingFile.name}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {(uploadingFile.size / 1024 / 1024).toFixed(2)} MB • {uploadingFile.name.split('.').pop()?.toUpperCase()}
                  </p>
                </div>
              </div>

              <div>
                <div className="h-1.5 bg-zinc-200 dark:bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 text-center mt-1.5">
                  {isUploading ? `Indexing chunks (${uploadProgress}%)...` : 'Ready to index'}
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => { setShowUpload(false); setUploadingFile(null); }}
                  disabled={isUploading}
                  className="btn-secondary text-xs flex-1 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="btn-primary text-xs flex-1 py-2 flex items-center justify-center gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    'Upload & Ingest'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Chunks Viewer Modal */}
      {viewingChunks && currentDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => { setViewingChunks(false); setCurrentDocument(null); }}
        >
          <div
            className="bg-white dark:bg-dark-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {currentDocument.original_filename}
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono">
                    {currentDocument.chunk_count} Chunks • Ingested {formatDate(currentDocument.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setViewingChunks(false); setCurrentDocument(null); }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-dark-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chunk Search Bar */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-dark-950/40">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={chunkSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChunkSearchQuery(val);
                    if (!val) handleSearchDocumentChunks(currentDocument.id, '');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchDocumentChunks(currentDocument.id, chunkSearchQuery);
                    }
                  }}
                  placeholder="Semantic query inside document chunks..."
                  className="input pl-9 pr-9 text-xs"
                />
                {chunkSearchQuery && (
                  <button
                    onClick={() => {
                      setChunkSearchQuery('');
                      handleSearchDocumentChunks(currentDocument.id, '');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 scrollbar-thin">
              {isSearchingChunks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
              ) : (chunks[currentDocument.id] || []).length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-10">No chunks matching query</p>
              ) : (
                chunks[currentDocument.id].map((chunk: DocumentChunk, index: number) => (
                  <div
                    key={chunk.id || index}
                    className="p-4 bg-zinc-50 dark:bg-dark-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs leading-relaxed"
                  >
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-200 dark:border-zinc-800/80">
                      <span className="font-mono font-medium text-primary-600 dark:text-primary-400">
                        Chunk #{chunk.chunk_index + 1}
                      </span>
                      {chunk.page_number && (
                        <span className="text-[10px] font-mono bg-zinc-200 dark:bg-dark-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                          Page {chunk.page_number}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-dark-950 flex justify-end">
              <button
                onClick={() => { setViewingChunks(false); setCurrentDocument(null); }}
                className="btn-secondary text-xs py-1.5 px-4"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  onView,
  onDelete,
}: {
  doc: Document;
  onView: (doc: Document) => void;
  onDelete: (id: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={() => onView(doc)}
      className="card p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-dark-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {doc.original_filename}
            </h4>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {doc.processing_status}
              </span>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
            <span>{doc.chunk_count} Chunks</span>
            <span>•</span>
            <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
            <span>•</span>
            <span>Uploaded {formatRelativeTime(doc.created_at)}</span>
          </div>
        </div>

        {/* Action Button */}
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
                  onView(doc);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-dark-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-200"
              >
                <Eye className="w-3.5 h-3.5" /> View Chunks
              </button>
              <button
                onClick={() => {
                  onDelete(doc.id);
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
