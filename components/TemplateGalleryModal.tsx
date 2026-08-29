import React, { useState } from 'react';
import { ProjectTemplate, Project, User } from '../types';
import { ASANA_TEMPLATES } from '../utils/templatesData';
import { enhancedApi } from '../services/enhancedApi';
import { useToast } from '../utils/ux';
import { 
  XIcon, 
  PlusIcon, 
  CheckCircleIcon, 
  FolderIcon, 
  BoltIcon, 
  FileTextIcon, 
  CalendarIcon, 
  UserIcon,
  TagIcon
} from './icons';

interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onProjectCreated: (project: Project) => void;
  activeProjectToSave?: Project;
}

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProjectCreated,
  activeProjectToSave
}) => {
  const { addToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(ASANA_TEMPLATES[0]);
  const [projectName, setProjectName] = useState(ASANA_TEMPLATES[0]?.name || 'My New Project');
  const [isCreating, setIsCreating] = useState(false);
  const [mode, setMode] = useState<'browse' | 'save_custom'>('browse');

  // Save custom template state
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateCategory, setCustomTemplateCategory] = useState<ProjectTemplate['category']>('general');
  const [customTemplateDesc, setCustomTemplateDesc] = useState('');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'agile', label: 'Agile & Engineering' },
    { id: 'marketing', label: 'Marketing & GTM' },
    { id: 'operations', label: 'Operations & Events' },
    { id: 'hr', label: 'HR & People' },
  ];

  const filteredTemplates = selectedCategory === 'all'
    ? ASANA_TEMPLATES
    : ASANA_TEMPLATES.filter(t => t.category === selectedCategory);

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectName(template.name);
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;

    setIsCreating(true);
    try {
      const newProj = await enhancedApi.createProjectFromTemplate(
        selectedTemplate.id,
        projectName.trim(),
        currentUser.uid
      );
      onProjectCreated(newProj);
      onClose();
    } catch (err) {
      console.error('Failed to create project from template:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveCurrentAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectToSave || !customTemplateName.trim()) return;

    setIsCreating(true);
    try {
      await enhancedApi.saveProjectAsTemplate(
        activeProjectToSave.id,
        customTemplateName.trim(),
        customTemplateCategory,
        customTemplateDesc.trim()
      );
      addToast({
        type: 'success',
        title: 'Template Saved',
        message: `Project saved as "${customTemplateName}" template!`
      });
      setMode('browse');
    } catch (err: any) {
      console.error('Failed to save project as template:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Failed to save project as template'
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <FolderIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Project Template Gallery</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Launch standard Asana workflows with pre-configured sections and fields.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {activeProjectToSave && mode === 'browse' && (
              <button
                onClick={() => {
                  setCustomTemplateName(`${activeProjectToSave.name} Template`);
                  setCustomTemplateDesc(activeProjectToSave.description || '');
                  setMode('save_custom');
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
              >
                + Save Current Project as Template
              </button>
            )}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mode === 'save_custom' ? (
          /* Save Custom Template Form */
          <form onSubmit={handleSaveCurrentAsTemplate} className="p-6 space-y-4 text-xs overflow-y-auto">
            <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 dark:text-white mb-2">
              <button type="button" onClick={() => setMode('browse')} className="text-blue-600 hover:underline">
                ← Back to Gallery
              </button>
              <span>/ Save "{activeProjectToSave?.name}" as Reusable Template</span>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Template Title</label>
              <input
                type="text"
                required
                value={customTemplateName}
                onChange={e => setCustomTemplateName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={customTemplateCategory}
                onChange={e => setCustomTemplateCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="agile">Agile & Engineering</option>
                <option value="marketing">Marketing & GTM</option>
                <option value="operations">Operations & Events</option>
                <option value="hr">HR & People</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Template Description</label>
              <textarea
                rows={3}
                value={customTemplateDesc}
                onChange={e => setCustomTemplateDesc(e.target.value)}
                placeholder="Explain the purpose of this workflow template..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMode('browse')}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !customTemplateName.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
              >
                {isCreating ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        ) : (
          /* Browse Templates Two-Column View */
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
            {/* Left Column: Categories and Template List */}
            <div className="md:col-span-5 border-r border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-slate-900/50">
              {/* Category Pills */}
              <div className="p-3 border-b border-gray-200 dark:border-slate-800 flex flex-wrap gap-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Templates List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredTemplates.map(template => {
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500 shadow-xs'
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-gray-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 mb-1">
                        <div className={`w-6 h-6 rounded-lg ${template.color} text-white flex items-center justify-center text-xs font-bold`}>
                          ★
                        </div>
                        <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{template.name}</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-2 text-[10px] text-gray-400">
                        <span>{template.sections.length} sections</span>
                        <span>•</span>
                        <span>{template.customFields.length} custom fields</span>
                        <span>•</span>
                        <span>{template.sampleTasks.length} tasks</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Template Deep-Dive Preview & Launch */}
            <div className="md:col-span-7 flex flex-col overflow-hidden p-6 text-xs bg-white dark:bg-slate-900">
              {selectedTemplate ? (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                        {selectedTemplate.category} Template
                      </span>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                        {selectedTemplate.name}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {selectedTemplate.description}
                      </p>
                    </div>
                  </div>

                  {/* Template Details Scroll Area */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                    {/* Workflow Sections */}
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                        Included Workflow Sections ({selectedTemplate.sections.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.sections.map((sec, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                            <span className={`w-2 h-2 rounded-full ${sec.color || 'bg-blue-500'}`} />
                            <span className="font-semibold text-gray-800 dark:text-slate-200">{sec.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pre-configured Custom Fields */}
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                        Pre-Configured Custom Fields ({selectedTemplate.customFields.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedTemplate.customFields.map((cf, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-800 dark:text-slate-200">{cf.name}</span>
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60">
                                {cf.type}
                              </span>
                            </div>
                            {cf.options && (
                              <p className="text-[10px] text-gray-400 mt-1 truncate">
                                {cf.options.join(' • ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sample Tasks Preview */}
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                        Starter Tasks ({selectedTemplate.sampleTasks.length})
                      </h4>
                      <div className="space-y-1.5">
                        {selectedTemplate.sampleTasks.map((t, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800">
                            <div className="flex items-center space-x-2 min-w-0">
                              <CheckCircleIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">{t.title}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 shrink-0">
                              {t.sectionName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
                    <div>
                      <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
                        New Project Name
                      </label>
                      <input
                        type="text"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white font-semibold"
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateFromTemplate}
                        disabled={isCreating || !projectName.trim()}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 shadow-xs"
                      >
                        {isCreating ? 'Setting Up...' : 'Use This Template'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Select a template to preview details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateGalleryModal;
