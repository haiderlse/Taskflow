import React, { useState } from 'react';
import { Project, CustomField, User } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { XIcon, PlusIcon, TagIcon, TrashIcon, CheckIcon } from './icons';

interface CustomFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  currentUser: User;
  onFieldAdded: (newField: CustomField) => void;
}

export const CustomFieldsModal: React.FC<CustomFieldsModalProps> = ({
  isOpen,
  onClose,
  project,
  currentUser,
  onFieldAdded
}) => {
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<CustomField['type']>('dropdown');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [dropdownOptionsText, setDropdownOptionsText] = useState('High, Medium, Low');
  const [isRequired, setIsRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName.trim()) return;

    setIsSubmitting(true);
    try {
      const options = (fieldType === 'dropdown' || fieldType === 'multiselect')
        ? dropdownOptionsText.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      const created = await enhancedApi.addProjectCustomField(project.id, {
        name: fieldName.trim(),
        type: fieldType,
        options,
        currencyCode: fieldType === 'currency' ? currencySymbol : undefined,
        isRequired,
        createdBy: currentUser.uid
      });

      onFieldAdded(created);
      setFieldName('');
      onClose();
    } catch (err) {
      console.error('Failed to create custom field:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldTypeOptions: { type: CustomField['type']; label: string; desc: string; icon: string }[] = [
    { type: 'dropdown', label: 'Single-Select Dropdown', desc: 'Choose one option from a list of badges', icon: '🔽' },
    { type: 'multiselect', label: 'Multi-Select Tags', desc: 'Select multiple tags from a list', icon: '🏷️' },
    { type: 'currency', label: 'Currency', desc: 'Monetary values ($ / € / £ / ¥)', icon: '💰' },
    { type: 'number', label: 'Numeric / Story Points', desc: 'Whole numbers, decimals, story points', icon: '🔢' },
    { type: 'percentage', label: 'Progress Percentage', desc: '0% to 100% progress metrics', icon: '📊' },
    { type: 'text', label: 'Short Text', desc: 'Freeform single-line notes or codes', icon: '✍️' },
    { type: 'date', label: 'Date', desc: 'Calendar date selection', icon: '📅' },
    { type: 'checkbox', label: 'Checkbox (Yes / No)', desc: 'Boolean switch or check verification', icon: '☑️' },
    { type: 'rating', label: 'Rating (1 - 5)', desc: 'Score or priority weight', icon: '⭐' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Custom Fields Manager</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Add metadata fields to track custom data across tasks.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Project Fields */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
            Active Project Fields ({(project.customFields || []).length})
          </span>
          {(project.customFields || []).length === 0 ? (
            <p className="text-xs text-gray-400 italic">No custom fields yet. Create your first field below.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(project.customFields || []).map(f => (
                <span key={f.id} className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-800 dark:text-slate-200">
                  <span>{f.name}</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">({f.type})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Create Field Form */}
        <form onSubmit={handleCreateField} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Field Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Story Points, Marketing Channel, Estimated Budget"
              value={fieldName}
              onChange={e => setFieldName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Field Type Radio Grid */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-2">Field Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {fieldTypeOptions.map(opt => (
                <button
                  type="button"
                  key={opt.type}
                  onClick={() => setFieldType(opt.type)}
                  className={`flex items-start space-x-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    fieldType === opt.type
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500'
                      : 'border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <div className="min-w-0">
                    <span className="font-bold text-gray-900 dark:text-white block truncate">{opt.label}</span>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 block truncate">{opt.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Type-Specific Options */}
          {(fieldType === 'dropdown' || fieldType === 'multiselect') && (
            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
                Options (Comma separated)
              </label>
              <input
                type="text"
                value={dropdownOptionsText}
                onChange={e => setDropdownOptionsText(e.target.value)}
                placeholder="Option A, Option B, Option C"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {fieldType === 'currency' && (
            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Currency Symbol</label>
              <select
                value={currencySymbol}
                onChange={e => setCurrencySymbol(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="$">$ (USD / AUD / CAD)</option>
                <option value="€">€ (EUR)</option>
                <option value="£">£ (GBP)</option>
                <option value="¥">¥ (JPY / CNY)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </div>
          )}

          {/* Required checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isRequired"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isRequired" className="text-xs text-gray-700 dark:text-slate-300 font-semibold cursor-pointer">
              Require this field when creating new tasks
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !fieldName.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Creating...' : 'Add to Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomFieldsModal;
