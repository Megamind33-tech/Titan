/**
 * Menu Bar Component
 *
 * Main menu for Titan with File, Edit, View, Help menus.
 * Provides quick access to project operations including GitHub import.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Github, History, Plus, Download, HelpCircle } from 'lucide-react';
import { getFormattedHistory, clearImportHistory } from '../services/ImportHistoryService';

interface MenuBarProps {
  onImportClick: () => void;
  onExportClick: () => void;
  onNewProject: () => void;
  recentProjects?: Array<{ id: string; name: string; projectType: string }>;
}

type MenuType = 'file' | 'edit' | 'view' | 'help' | null;

export const MenuBar: React.FC<MenuBarProps> = ({
  onImportClick,
  onExportClick,
  onNewProject,
  recentProjects = [],
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [importHistory, setImportHistory] = useState(getFormattedHistory());
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const editMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-trigger]') && !target.closest('[data-menu-content]')) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportClick = () => {
    setActiveMenu(null);
    onImportClick();
  };

  const handleExportClick = () => {
    setActiveMenu(null);
    onExportClick();
  };

  const handleClearHistory = () => {
    clearImportHistory();
    setImportHistory([]);
  };

  return (
    <div className="bg-[#0f0f12]/95 backdrop-blur-md border-b border-white/5 h-10 flex items-center px-4 z-40">
      {/* File Menu */}
      <div className="relative" ref={fileMenuRef}>
        <button
          data-menu-trigger="file"
          onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
          className="flex items-center gap-1 px-3 py-1 hover:bg-white/5 rounded text-[11px] font-mono uppercase tracking-widest text-white/70 hover:text-white transition-colors"
        >
          <span>File</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${activeMenu === 'file' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'file' && (
          <div
            data-menu-content="file"
            className="absolute top-full left-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded shadow-xl min-w-[280px] overflow-hidden"
          >
            {/* New Project */}
            <button
              onClick={onNewProject}
              className="w-full px-4 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-3 h-3" />
                New Project
              </span>
              <span className="text-[9px] text-white/40">Ctrl+N</span>
            </button>

            <div className="border-t border-white/5" />

            {/* Import from GitHub */}
            <button
              onClick={handleImportClick}
              className="w-full px-4 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Github className="w-3 h-3" />
                Import from GitHub
              </span>
              <span className="text-[9px] text-white/40">Ctrl+I</span>
            </button>

            <div className="border-t border-white/5" />

            {/* Recent Projects */}
            <div>
              <div className="px-4 py-1 text-[9px] font-mono uppercase tracking-widest text-white/40 bg-white/[0.02]">
                <History className="w-3 h-3 inline mr-1" />
                Recent Imports
              </div>
              {importHistory.length > 0 ? (
                <>
                  {importHistory.slice(0, 5).map((entry, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveMenu(null);
                        // Could trigger auto-import here
                      }}
                      className="w-full px-4 py-1.5 text-left text-[9px] font-mono text-white/50 hover:text-white hover:bg-white/5 border-b border-white/5 last:border-b-0"
                      title={`Last imported: ${entry.lastImported}`}
                    >
                      <div className="truncate">{entry.label}</div>
                      <div className="text-[8px] text-white/30">{entry.lastImported}</div>
                    </button>
                  ))}
                  <button
                    onClick={handleClearHistory}
                    className="w-full px-4 py-1 text-left text-[8px] font-mono uppercase tracking-widest text-white/40 hover:text-white/60 hover:bg-white/5 border-t border-white/5"
                  >
                    Clear History
                  </button>
                </>
              ) : (
                <div className="px-4 py-2 text-[9px] text-white/30">No imports yet</div>
              )}
            </div>

            <div className="border-t border-white/5" />

            {/* Export */}
            <button
              onClick={handleExportClick}
              className="w-full px-4 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Download className="w-3 h-3" />
                Export Scene
              </span>
              <span className="text-[9px] text-white/40">Ctrl+E</span>
            </button>

            <div className="border-t border-white/5" />

            {/* Exit */}
            <button
              onClick={() => {
                setActiveMenu(null);
                // Could implement exit functionality
              }}
              className="w-full px-4 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/5"
            >
              Exit
            </button>
          </div>
        )}
      </div>

      {/* Edit Menu */}
      <div className="relative" ref={editMenuRef}>
        <button
          data-menu-trigger="edit"
          onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
          className="flex items-center gap-1 px-3 py-1 hover:bg-white/5 rounded text-[11px] font-mono uppercase tracking-widest text-white/70 hover:text-white transition-colors"
        >
          <span>Edit</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${activeMenu === 'edit' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'edit' && (
          <div
            data-menu-content="edit"
            className="absolute top-full left-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded shadow-xl min-w-[200px] overflow-hidden"
          >
            <div className="px-4 py-2 text-[9px] text-white/40">
              Undo/Redo available in toolbar
            </div>
          </div>
        )}
      </div>

      {/* View Menu */}
      <div className="relative" ref={viewMenuRef}>
        <button
          data-menu-trigger="view"
          onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
          className="flex items-center gap-1 px-3 py-1 hover:bg-white/5 rounded text-[11px] font-mono uppercase tracking-widest text-white/70 hover:text-white transition-colors"
        >
          <span>View</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${activeMenu === 'view' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'view' && (
          <div
            data-menu-content="view"
            className="absolute top-full left-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded shadow-xl min-w-[200px] overflow-hidden"
          >
            <div className="px-4 py-2 text-[9px] text-white/40">
              Toggle in toolbar or Sidebar
            </div>
          </div>
        )}
      </div>

      {/* Help Menu */}
      <div className="relative ml-auto" ref={helpMenuRef}>
        <button
          data-menu-trigger="help"
          onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
          className="flex items-center gap-1 px-3 py-1 hover:bg-white/5 rounded text-[11px] font-mono uppercase tracking-widest text-white/70 hover:text-white transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          <span>Help</span>
        </button>

        {activeMenu === 'help' && (
          <div
            data-menu-content="help"
            className="absolute top-full right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded shadow-xl min-w-[250px] overflow-hidden"
          >
            <div className="px-4 py-3 text-[9px] font-mono text-white/60 space-y-1">
              <div><strong>Ctrl+I</strong> - Import from GitHub</div>
              <div><strong>Ctrl+E</strong> - Export Scene</div>
              <div><strong>Ctrl+Z</strong> - Undo</div>
              <div><strong>Ctrl+Y</strong> - Redo</div>
            </div>
            <div className="border-t border-white/5 px-4 py-2 text-[9px] text-white/40">
              Titan - SWIM26 Project Builder v1.0
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
