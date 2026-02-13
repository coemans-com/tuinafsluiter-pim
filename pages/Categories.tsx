
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Percent, Tag, Loader2, AlertTriangle } from 'lucide-react';
import { Category } from '../types';

interface CategoriesProps {
  categories: Category[];
  onAdd: (c: Category) => void;
  onUpdate: (c: Category) => void;
  onDelete: (id: string) => Promise<void>;
}

const Categories: React.FC<CategoriesProps> = ({ categories, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Category, 'id'>>({ name: '', defaultMargin: 0.3 });
  
  // Track deleting state for specific category ID
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Confirmation Modal State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingId(category.id);
      setFormData({ name: category.name, defaultMargin: category.defaultMargin });
    } else {
      setEditingId(null);
      setFormData({ name: '', defaultMargin: 0.3 });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (editingId) {
      onUpdate({ ...formData, id: editingId });
    } else {
      onAdd({ ...formData, id: `cat_${Date.now()}` });
    }
    setIsModalOpen(false);
  };

  const requestDelete = (id: string) => {
      setConfirmDeleteId(id);
  };

  const performDelete = async () => {
    if (!confirmDeleteId) return;
    
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null); // Close confirm modal
    
    try {
      await onDelete(confirmDeleteId);
    } catch (error) {
      console.error("Failed to delete", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Categories</h2>
          <p className="text-slate-500 mt-1">Manage product categories and default margins.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Default Margin</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-blue-600">
                        <Tag className="w-4 h-4" />
                    </div>
                    <div className="text-sm font-medium text-slate-900">{category.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  <span className="inline-flex items-center bg-slate-100 px-2.5 py-0.5 rounded text-slate-800 font-mono">
                     <Percent className="w-3 h-3 mr-1 text-slate-400" />
                     {(category.defaultMargin * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button onClick={(e) => { e.stopPropagation(); handleOpenModal(category); }} className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); requestDelete(category.id); }} 
                    className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                    disabled={deletingId === category.id}
                  >
                    {deletingId === category.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
                <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500 italic">No categories found. Create one to get started.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Category' : 'New Category'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-slate-900"
                  placeholder="e.g. Electronics"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Margin</label>
                <div className="relative rounded-md shadow-sm">
                    <input 
                      type="number" 
                      step="1"
                      min="0"
                      max="100"
                      value={Math.round(formData.defaultMargin * 100)}
                      onChange={(e) => setFormData({...formData, defaultMargin: (parseInt(e.target.value) || 0) / 100})}
                      className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 pr-8 bg-white text-slate-900"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <span className="text-slate-500 sm:text-sm">%</span>
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Used to calculate default pricing from cost.</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50 rounded-b-xl">
               <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium">Cancel</button>
               <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center shadow-sm">
                 <Save className="w-4 h-4 mr-2" /> Save
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 text-center">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Category?</h3>
                      <p className="text-sm text-slate-500">
                          Are you sure you want to delete this category? 
                          This action cannot be undone if not connected to products.
                      </p>
                  </div>
                  <div className="flex border-t border-slate-200">
                      <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-r border-slate-200"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={performDelete}
                        className="flex-1 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                      >
                          Delete
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Categories;
