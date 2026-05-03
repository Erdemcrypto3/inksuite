'use client';

import { useState } from 'react';
import type { CategoryItem } from './contract';
import { loadCategories, saveCategories, DEFAULT_CATEGORIES } from './contract';

type Article = {
  tags: string[];
  active: boolean;
};

export function CategoryManagerWithCounts({ articles, onClose }: { articles: Article[]; onClose: () => void }) {
  const [categories, setCategories] = useState<CategoryItem[]>(loadCategories());
  const [newMain, setNewMain] = useState('');
  const [newSub, setNewSub] = useState('');
  const [editingMain, setEditingMain] = useState<number | null>(null);

  // Tags are stored as sub-category names only (contract 32-byte limit)
  const getSubCount = (subName: string): number => {
    return articles.filter((a) =>
      a.tags.some((t) => t.toLowerCase() === subName.toLowerCase())
    ).length;
  };

  // Main category count = sum of all its subs' article counts
  const getMainCount = (cat: CategoryItem): number => {
    const subNames = new Set(cat.subs.map((s) => s.toLowerCase()));
    return articles.filter((a) =>
      a.tags.some((t) => subNames.has(t.toLowerCase()))
    ).length;
  };

  const save = (cats: CategoryItem[]) => {
    setCategories(cats);
    saveCategories(cats);
  };

  const addMainCategory = () => {
    if (!newMain.trim()) return;
    if (categories.some((c) => c.main.toLowerCase() === newMain.trim().toLowerCase())) return;
    save([...categories, { main: newMain.trim(), subs: [] }]);
    setNewMain('');
  };

  const removeMainCategory = (index: number) => {
    const count = getMainCount(categories[index]!);
    if (count > 0) {
      alert(`Cannot remove "${categories[index]!.main}" — it has ${count} article(s). Unpublish or reassign articles first, or remove the subcategories one by one.`);
      return;
    }
    save(categories.filter((_, i) => i !== index));
  };

  const addSubCategory = (mainIndex: number) => {
    if (!newSub.trim()) return;
    const cats = [...categories];
    if (cats[mainIndex]!.subs.some((s) => s.toLowerCase() === newSub.trim().toLowerCase())) return;
    cats[mainIndex] = { ...cats[mainIndex]!, subs: [...cats[mainIndex]!.subs, newSub.trim()] };
    save(cats);
    setNewSub('');
  };

  const removeSubCategory = (mainIndex: number, subIndex: number) => {
    const subName = categories[mainIndex]!.subs[subIndex]!;
    const count = getSubCount(subName);
    if (count > 0) {
      alert(`Cannot remove "${subName}" — it has ${count} article(s). Unpublish or reassign articles first.`);
      return;
    }
    const cats = [...categories];
    cats[mainIndex] = { ...cats[mainIndex]!, subs: cats[mainIndex]!.subs.filter((_, i) => i !== subIndex) };
    save(cats);
  };

  const resetDefaults = () => {
    if (!confirm('Reset all categories to defaults? Custom categories will be lost.')) return;
    save(DEFAULT_CATEGORIES);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Manage Categories</h2>
          <p className="mt-1 text-xs text-ink-500">{categories.length} main categories · {articles.length} total articles</p>
        </div>
        <button onClick={onClose} className="rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-200">
          ← Back
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((cat, mi) => {
          const mainCount = getMainCount(cat);
          return (
            <div key={mi} className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">{cat.main}</h3>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-mono text-ink-600">{mainCount} articles</span>
                </div>
                <button onClick={() => removeMainCategory(mi)}
                  className={`text-xs ${mainCount > 0 ? 'text-amber-500 hover:text-amber-700' : 'text-red-400 hover:text-red-600'}`}>
                  Remove
                </button>
              </div>
              <div className="ml-4 space-y-1">
                {cat.subs.map((sub, si) => {
                  const subCount = getSubCount(sub);
                  return (
                    <div key={si} className="flex items-center justify-between rounded bg-ink-50 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-700">{sub}</span>
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-mono text-ink-500">{subCount}</span>
                      </div>
                      <button onClick={() => removeSubCategory(mi, si)}
                        className={`text-[10px] ${subCount > 0 ? 'text-amber-500' : 'text-red-400'} hover:text-red-600`}>
                        x
                      </button>
                    </div>
                  );
                })}
                {editingMain === mi ? (
                  <div className="flex gap-2 mt-2">
                    <input value={newSub} onChange={(e) => setNewSub(e.target.value)}
                      placeholder="New subcategory..."
                      className="flex-1 rounded border border-purple-200 bg-ink-50 px-3 py-1.5 text-xs focus:border-ink-500 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && addSubCategory(mi)} />
                    <button onClick={() => addSubCategory(mi)} className="rounded bg-ink-500 px-3 py-1.5 text-xs text-white">Add</button>
                    <button onClick={() => { setEditingMain(null); setNewSub(''); }} className="text-xs text-ink-400">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingMain(mi)} className="mt-1 text-xs text-ink-500 hover:text-ink-700">+ Add subcategory</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Add Main Category</h3>
        <div className="flex gap-2">
          <input value={newMain} onChange={(e) => setNewMain(e.target.value)}
            placeholder="Category name..."
            className="flex-1 rounded-lg border border-purple-200 bg-ink-50 px-4 py-2 text-sm focus:border-ink-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && addMainCategory()} />
          <button onClick={addMainCategory} className="rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-600">Add</button>
        </div>
      </div>

      <button onClick={resetDefaults} className="text-xs text-ink-400 hover:text-ink-600">Reset to default categories</button>
    </div>
  );
}
