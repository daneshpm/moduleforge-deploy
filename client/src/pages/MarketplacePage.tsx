import React, { useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Boxes, Plus, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModuleStore } from '../store/useModuleStore';
import { ModuleCard } from '../components/ModuleCard';

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    modules,
    categories,
    selectedCategory,
    searchQuery,
    sortBy,
    isLoading,
    fetchModules,
    fetchCategories,
    setCategory,
    setSearchQuery,
    setSortBy,
  } = useModuleStore();

  useEffect(() => {
    fetchCategories();
    fetchModules();
  }, [fetchCategories, fetchModules]);

  const allCategories = ['All', ...categories.map((c) => c.name)];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Boxes className="w-7 h-7 text-indigo-400" />
            <span>Module Marketplace</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse reusable software modules, inspect entry points, and add them to your visual canvas.
          </p>
        </div>

        <button
          onClick={() => navigate('/modules/create')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Publish Module</span>
        </button>
      </div>

      {/* Filter Toolbar: Search, Sort & Category Pills */}
      <div className="glass-panel p-4 rounded-xl space-y-4 border border-slate-800">
        {/* Row 1: Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter modules by keyword, slug, description or author..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-mono">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="popular">Most Popular</option>
              <option value="downloads">Most Downloaded</option>
              <option value="newest">Newest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 no-scrollbar">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
          {allCategories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Grid */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-400">Loading marketplace modules...</p>
        </div>
      ) : modules.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-2xl border border-slate-800 p-8 space-y-3 max-w-md mx-auto">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Modules Found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No software modules matched category <span className="text-indigo-400 font-mono">"{selectedCategory}"</span> with query <span className="text-indigo-400 font-mono">"{searchQuery}"</span>.
          </p>
          <button
            onClick={() => {
              setCategory('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      )}
    </div>
  );
};
