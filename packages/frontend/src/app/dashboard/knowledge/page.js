'use client';

import { useState, useCallback } from 'react';
import {
  useFAQs,
  useFAQCategories,
  useCreateFAQ,
  useUpdateFAQ,
  useDeleteFAQ,
  useBulkImportFAQs,
  useKBDocuments,
  useCreateKBDocument,
  useDeleteKBDocument,
  useUploadDocument,
} from '@/hooks/queries';
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  Label,
  Badge,
  Spinner,
  EmptyState,
} from '@/components/ui';
import { Toaster, toast } from '@/components/ui/Toaster';
import {
  QuestionMarkCircleIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  BookOpenIcon,
  TagIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

// ─── Constants ───────────────────────────────────────────────────────
const TABS = [
  { id: 'faqs', label: 'FAQs', icon: QuestionMarkCircleIcon },
  { id: 'documents', label: 'Documents', icon: DocumentTextIcon },
];

// ─── FAQ Form Modal ──────────────────────────────────────────────────
function FAQFormModal({ faq, categories, onClose, onSave, isSaving }) {
  const [form, setForm] = useState({
    question: faq?.question || '',
    answer: faq?.answer || '',
    category: faq?.category || '',
    keywords: faq?.keywords?.join(', ') || '',
    isActive: faq?.isActive ?? true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) return;
    onSave({
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category.trim() || null,
      keywords: form.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      isActive: form.isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            {faq ? 'Edit FAQ' : 'Add FAQ'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label required>Question</Label>
            <Textarea
              rows={2}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="e.g. What are your business hours?"
            />
          </div>
          <div>
            <Label required>Answer</Label>
            <Textarea
              rows={4}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="e.g. We are open Monday–Friday 9 AM to 5 PM."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Hours, Pricing"
                list="faq-categories"
              />
              <datalist id="faq-categories">
                {(categories || []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Keywords (comma separated)</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="hours, schedule, open"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="faq-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="faq-active" className="text-sm text-secondary-700 dark:text-secondary-300">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSaving} disabled={!form.question.trim() || !form.answer.trim()}>
              {faq ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ──────────────────────────────────────────────
function BulkImportModal({ onClose, onImport, isImporting }) {
  const [text, setText] = useState('');

  const handleImport = () => {
    try {
      const faqs = JSON.parse(text);
      if (!Array.isArray(faqs)) throw new Error('Must be an array');
      onImport(faqs);
    } catch {
      toast.error('Invalid JSON. Please provide an array of {question, answer, category?, keywords?} objects.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Bulk Import FAQs
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-secondary-500">
            Paste a JSON array of FAQ objects. Each object should have <code>question</code> and <code>answer</code> fields.
            Optional: <code>category</code>, <code>keywords</code> (array of strings).
          </p>
          <Textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`[\n  {\n    "question": "What are your hours?",\n    "answer": "We are open 9-5 M-F.",\n    "category": "Hours"\n  }\n]`}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} loading={isImporting}>Import</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Document Form Modal ────────────────────────────────────────────
function DocumentFormModal({ onClose, onSave, isSaving }) {
  const [form, setForm] = useState({ title: '', description: '', content: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      content: form.content.trim(),
      sourceType: 'manual',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Add Knowledge Base Document
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label required>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Service Pricing Guide"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the document"
            />
          </div>
          <div>
            <Label required>Content</Label>
            <Textarea
              rows={10}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Paste or type the document content here..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSaving} disabled={!form.title.trim() || !form.content.trim()}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Upload Document Modal ──────────────────────────────────────────
function UploadDocumentModal({ onClose, onUpload, isUploading }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const supportedExts = '.txt,.csv,.md,.html,.pdf,.docx,.json';

  const handleFile = (f) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);
    onUpload(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Upload Document
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                : 'border-secondary-300 dark:border-secondary-600'
            }`}
          >
            <ArrowUpTrayIcon className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
            {file ? (
              <div className="text-sm">
                <p className="font-medium text-secondary-900 dark:text-white">{file.name}</p>
                <p className="text-secondary-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-secondary-600 dark:text-secondary-300">
                  Drag & drop a file here, or{' '}
                  <label className="text-primary-600 cursor-pointer hover:underline">
                    browse
                    <input
                      type="file"
                      accept={supportedExts}
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                </p>
                <p className="text-xs text-secondary-400 mt-1">
                  TXT, CSV, MD, HTML, PDF, DOCX, JSON — max 10 MB
                </p>
              </>
            )}
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title (auto-filled from filename)"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isUploading} disabled={!file}>
              Upload & Parse
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── FAQ Row ────────────────────────────────────────────────────────
function FAQRow({ faq, onEdit, onDelete, isDeleting }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <QuestionMarkCircleIcon className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-secondary-900 dark:text-white truncate">
              {faq.question}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {faq.category && (
                <Badge variant="secondary">
                  <TagIcon className="h-3 w-3 mr-1 inline" />
                  {faq.category}
                </Badge>
              )}
              {!faq.isActive && <Badge variant="warning">Inactive</Badge>}
              <span className="text-xs text-secondary-400">{faq.hitCount || 0} hits</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(faq); }}
            className="p-1.5 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-600"
          >
            <PencilSquareIcon className="h-4 w-4 text-secondary-500" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(faq.id); }}
            disabled={isDeleting}
            className="p-1.5 rounded-lg hover:bg-danger-100 dark:hover:bg-danger-900/30"
          >
            <TrashIcon className="h-4 w-4 text-danger-500" />
          </button>
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4 text-secondary-400" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-secondary-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-secondary-100 dark:border-secondary-700">
          <p className="text-sm text-secondary-700 dark:text-secondary-300 whitespace-pre-wrap mt-3">
            {faq.answer}
          </p>
          {faq.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {faq.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-secondary-100 dark:bg-secondary-700 rounded-full text-secondary-600 dark:text-secondary-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Document Row ───────────────────────────────────────────────────
function DocumentRow({ doc, onDelete, isDeleting }) {
  const [expanded, setExpanded] = useState(false);
  const chunks = Array.isArray(doc.chunks) ? doc.chunks : [];

  return (
    <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <DocumentTextIcon className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-secondary-900 dark:text-white truncate">
              {doc.title}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-secondary-400">
              <span>{doc.sourceType}</span>
              <span>{chunks.length} chunks</span>
              {doc.isProcessed && <Badge variant="success">Processed</Badge>}
              {!doc.isActive && <Badge variant="warning">Inactive</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
            disabled={isDeleting}
            className="p-1.5 rounded-lg hover:bg-danger-100 dark:hover:bg-danger-900/30"
          >
            <TrashIcon className="h-4 w-4 text-danger-500" />
          </button>
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4 text-secondary-400" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-secondary-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-secondary-100 dark:border-secondary-700">
          {doc.description && (
            <p className="text-sm text-secondary-500 mt-3">{doc.description}</p>
          )}
          <p className="text-sm text-secondary-700 dark:text-secondary-300 mt-3 whitespace-pre-wrap line-clamp-6">
            {doc.content?.slice(0, 800)}{doc.content?.length > 800 ? '...' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState('faqs');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFAQForm, setShowFAQForm] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // FAQ queries
  const faqParams = {};
  if (search) faqParams.search = search;
  if (categoryFilter) faqParams.category = categoryFilter;
  const { data: faqData, isLoading: faqsLoading } = useFAQs(faqParams);
  const { data: categoriesData } = useFAQCategories();

  const createFAQ = useCreateFAQ();
  const updateFAQ = useUpdateFAQ();
  const deleteFAQ = useDeleteFAQ();
  const bulkImport = useBulkImportFAQs();

  // Document queries
  const { data: docsData, isLoading: docsLoading } = useKBDocuments();
  const createDoc = useCreateKBDocument();
  const deleteDoc = useDeleteKBDocument();
  const uploadDoc = useUploadDocument();

  const faqs = faqData?.data || faqData?.faqs || [];
  const categories = categoriesData?.categories || categoriesData?.data || [];
  const documents = docsData?.data || docsData?.documents || [];

  // ─── Handlers ───────────────────────────────────────────────
  const handleSaveFAQ = useCallback(
    (data) => {
      if (editingFAQ) {
        updateFAQ.mutate(
          { id: editingFAQ.id, data },
          {
            onSuccess: () => {
              toast.success('FAQ updated');
              setEditingFAQ(null);
              setShowFAQForm(false);
            },
            onError: (err) => toast.error(err.response?.data?.error || 'Failed to update FAQ'),
          }
        );
      } else {
        createFAQ.mutate(data, {
          onSuccess: () => {
            toast.success('FAQ created');
            setShowFAQForm(false);
          },
          onError: (err) => toast.error(err.response?.data?.error || 'Failed to create FAQ'),
        });
      }
    },
    [editingFAQ, createFAQ, updateFAQ]
  );

  const handleDeleteFAQ = useCallback(
    (id) => {
      if (!confirm('Delete this FAQ?')) return;
      deleteFAQ.mutate(id, {
        onSuccess: () => toast.success('FAQ deleted'),
        onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete FAQ'),
      });
    },
    [deleteFAQ]
  );

  const handleBulkImport = useCallback(
    (faqs) => {
      bulkImport.mutate(faqs, {
        onSuccess: (res) => {
          const count = res.data?.imported || faqs.length;
          toast.success(`${count} FAQs imported`);
          setShowBulkImport(false);
        },
        onError: (err) => toast.error(err.response?.data?.error || 'Import failed'),
      });
    },
    [bulkImport]
  );

  const handleSaveDoc = useCallback(
    (data) => {
      createDoc.mutate(data, {
        onSuccess: () => {
          toast.success('Document created');
          setShowDocForm(false);
        },
        onError: (err) => toast.error(err.response?.data?.error || 'Failed to create document'),
      });
    },
    [createDoc]
  );

  const handleDeleteDoc = useCallback(
    (id) => {
      if (!confirm('Delete this document?')) return;
      deleteDoc.mutate(id, {
        onSuccess: () => toast.success('Document deleted'),
        onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete document'),
      });
    },
    [deleteDoc]
  );

  const handleUploadDoc = useCallback(
    (formData) => {
      uploadDoc.mutate(formData, {
        onSuccess: (res) => {
          const info = res.data?.parsing;
          toast.success(
            info
              ? `Document uploaded: ${info.words} words, ${info.chunks} chunks`
              : 'Document uploaded'
          );
          setShowUploadModal(false);
        },
        onError: (err) => toast.error(err.response?.data?.error || 'Upload failed'),
      });
    },
    [uploadDoc]
  );

  return (
    <div className="space-y-6">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white flex items-center gap-2">
            <BookOpenIcon className="h-7 w-7 text-primary-600" />
            Knowledge Base
          </h1>
          <p className="text-secondary-500 mt-1">
            Manage FAQs and documents that power your AI receptionist&apos;s answers.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary-100 dark:bg-secondary-800 p-1 rounded-lg w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
                  : 'text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── FAQs Tab ─────────────────────────────────────────── */}
      {activeTab === 'faqs' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-5 w-5 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search FAQs..."
                className="pl-10"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkImport(true)}>
                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                Import
              </Button>
              <Button onClick={() => { setEditingFAQ(null); setShowFAQForm(true); }}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Add FAQ
              </Button>
            </div>
          </div>

          {/* FAQ List */}
          {faqsLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : faqs.length === 0 ? (
            <EmptyState
              icon={QuestionMarkCircleIcon}
              title="No FAQs yet"
              description="Add frequently asked questions so your AI receptionist can answer them automatically."
              action={
                <Button onClick={() => { setEditingFAQ(null); setShowFAQForm(true); }}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add your first FAQ
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {faqs.map((faq) => (
                <FAQRow
                  key={faq.id}
                  faq={faq}
                  onEdit={(f) => { setEditingFAQ(f); setShowFAQForm(true); }}
                  onDelete={handleDeleteFAQ}
                  isDeleting={deleteFAQ.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Documents Tab ────────────────────────────────────── */}
      {activeTab === 'documents' && (
        <>
          {/* Toolbar */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadModal(true)}>
              <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
              Upload File
            </Button>
            <Button onClick={() => setShowDocForm(true)}>
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Manual
            </Button>
          </div>

          {/* Document List */}
          {docsLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={DocumentTextIcon}
              title="No documents yet"
              description="Add knowledge base documents with detailed information about your business for the AI to reference."
              action={
                <Button onClick={() => setShowDocForm(true)}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add your first document
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDelete={handleDeleteDoc}
                  isDeleting={deleteDoc.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Modals ───────────────────────────────────────────── */}
      {showFAQForm && (
        <FAQFormModal
          faq={editingFAQ}
          categories={categories}
          onClose={() => { setShowFAQForm(false); setEditingFAQ(null); }}
          onSave={handleSaveFAQ}
          isSaving={createFAQ.isPending || updateFAQ.isPending}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          isImporting={bulkImport.isPending}
        />
      )}

      {showDocForm && (
        <DocumentFormModal
          onClose={() => setShowDocForm(false)}
          onSave={handleSaveDoc}
          isSaving={createDoc.isPending}
        />
      )}

      {showUploadModal && (
        <UploadDocumentModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadDoc}
          isUploading={uploadDoc.isPending}
        />
      )}
    </div>
  );
}
