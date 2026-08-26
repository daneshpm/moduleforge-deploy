import React, { useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Boxes, Plus } from 'lucide-react';
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
          <h1 className="text-3xl font-black text-[#202524] tracking-tight flex items-center gap-3">
            <Boxes className="w-7 h-7 text-[#1F5E4B]" />
            <span className="primary-text-gradient">Module Marketplace</span>
          </h1>
          <p className="text-sm text-[#6B7471] mt-1">
            Browse verified reusable software modules, inspect schemas, and add them to your visual architecture canvas.
          </p>
        </div>

        <button
          onClick={() => navigate('/modules/create')}
          className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          <span>Publish Module</span>
        </button>
      </div>

      {/* Filter Toolbar: Search, Sort & Category Pills */}
      <div className="bg-white p-5 rounded-2xl space-y-4 border border-[#E2E6E4] shadow-card">
        {/* Row 1: Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter modules by keyword, category, description or author..."
              className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <ArrowUpDown className="w-4 h-4 text-[#1F5E4B]" />
            <span className="text-xs text-[#6B7471] font-mono">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#F7F8F7] border border-[#E2E6E4] text-[#202524] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#1F5E4B] font-mono cursor-pointer"
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
          <Filter className="w-4 h-4 text-[#1F5E4B] shrink-0 mr-1" />
          {allCategories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                  isSelected
                    ? 'bg-[#1F5E4B] text-white shadow-sm shadow-[#1F5E4B]/20'
                    : 'bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] hover:bg-[#EAF3EF] border border-[#E2E6E4]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modules Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white border border-[#E2E6E4] animate-pulse shadow-card" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#E2E6E4] space-y-4 shadow-card">
          <Boxes className="w-12 h-12 text-[#6B7471] mx-auto" />
          <h3 className="text-lg font-bold text-[#202524]">No modules match your criteria</h3>
          <p className="text-xs text-[#6B7471] max-w-sm mx-auto">
            Try adjusting your search filters, or be the first to publish a new software module to the repository.
          </p>
          <button
            onClick={() => navigate('/modules/create')}
            className="px-4 py-2 bg-[#1F5E4B] hover:bg-[#174739] text-white rounded-xl text-xs font-bold shadow-md shadow-[#1F5E4B]/20"
          >
            Upload New Module
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      )}
    </div>
  );
};
