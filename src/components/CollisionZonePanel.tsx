import React, { useState } from 'react';
import {
  Shield, Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, AlertTriangle, Info
} from 'lucide-react';
import {
  CollisionZone,
  CollisionZoneType,
  ZoneShape,
  ZONE_TYPE_DEFINITIONS,
  getZoneTypeDefinition,
  createZoneFromType,
} from '../types/collision';
import { PREDEFINED_TAGS } from '../types/tags';

interface CollisionZonePanelProps {
  zones: CollisionZone[];
  onAddZone: (zone: CollisionZone) => void;
  onUpdateZone: (id: string, updates: Partial<CollisionZone>) => void;
  onDeleteZone: (id: string) => void;
}

const SHAPE_OPTIONS: { value: ZoneShape; label: string }[] = [
  { value: 'box',      label: 'Box'      },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'sphere',   label: 'Sphere'   },
];

// Compact vector input (x / y / z)
function Vec3Input({
  label,
  value,
  step = 0.5,
  onChange,
}: {
  label: string;
  value: [number, number, number];
  step?: number;
  onChange: (v: [number, number, number]) => void;
}) {
  const fields: [string, number][] = [['X', value[0]], ['Y', value[1]], ['Z', value[2]]];
  return (
    <div className="space-y-1">
      <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {fields.map(([axis, val], i) => (
          <div key={axis} className="relative">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono text-white/20">{axis}</span>
            <input
              type="number"
              value={val}
              step={step}
              onChange={e => {
                const next = [...value] as [number, number, number];
                next[i] = parseFloat(e.target.value) || 0;
                onChange(next);
              }}
              className="w-full bg-black/30 border border-white/5 rounded text-[9px] font-mono text-white/70
                         pl-5 pr-1 py-1.5 focus:outline-none focus:border-white/20"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Tag multi-select
function TagSelect({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const allTags = PREDEFINED_TAGS.map(t => t.tag);
  const suggestions = input
    ? allTags.filter(t => t.toLowerCase().includes(input.toLowerCase()) && !selected.includes(t))
    : [];

  return (
    <div className="space-y-1.5">
      <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">{label}</span>
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {selected.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-mono text-white/60"
          >
            {tag}
            <button
              onClick={() => onChange(selected.filter(t => t !== tag))}
              className="text-white/30 hover:text-red-400 transition-colors"
            >✕</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              const t = input.trim();
              if (!selected.includes(t)) onChange([...selected, t]);
              setInput('');
            }
          }}
          placeholder="Add tag…"
          className="w-full bg-black/30 border border-white/5 rounded text-[9px] font-mono text-white/60
                     px-2 py-1.5 focus:outline-none focus:border-white/20 placeholder:text-white/15"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-0.5 z-10 bg-[#1e1f23] border border-white/10 rounded shadow-xl max-h-32 overflow-y-auto">
            {suggestions.slice(0, 8).map(s => (
              <button
                key={s}
                onClick={() => { onChange([...selected, s]); setInput(''); }}
                className="w-full text-left px-2 py-1 text-[9px] font-mono text-white/60 hover:bg-white/5"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Single zone row + expandable edit form
function ZoneRow({
  zone,
  onUpdate,
  onDelete,
}: {
  zone: CollisionZone;
  onUpdate: (updates: Partial<CollisionZone>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const def = getZoneTypeDefinition(zone.type);

  return (
    <div className="border border-white/5 rounded overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2 py-2 bg-black/20 cursor-pointer hover:bg-black/30 transition-colors select-none"
        onClick={() => setExpanded(p => !p)}
      >
        {/* Colour dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
          style={{ backgroundColor: zone.color }}
        />

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-white/70 truncate leading-tight">{zone.name}</p>
          <p className="text-[8px] font-mono text-white/25 uppercase tracking-widest">{def.label}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {/* Enabled toggle */}
          <button
            onClick={() => onUpdate({ enabled: !zone.enabled })}
            className="text-white/30 hover:text-white/70 transition-colors"
            title={zone.enabled ? 'Disable zone' : 'Enable zone'}
          >
            {zone.enabled
              ? <ToggleRight className="w-3.5 h-3.5 text-blue-400" />
              : <ToggleLeft  className="w-3.5 h-3.5" />}
          </button>

          {/* Visibility */}
          <button
            onClick={() => onUpdate({ visible: !zone.visible })}
            className="text-white/30 hover:text-white/70 transition-colors"
            title={zone.visible ? 'Hide in viewport' : 'Show in viewport'}
          >
            {zone.visible
              ? <Eye    className="w-3 h-3 text-white/40" />
              : <EyeOff className="w-3 h-3 text-white/20" />}
          </button>

          {/* Delete */}
          {confirmDelete ? (
            <>
              <button
                onClick={() => onDelete()}
                className="text-[8px] font-mono text-red-400 hover:text-red-300 px-1"
              >CONFIRM</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[8px] font-mono text-white/30 hover:text-white/60 px-1"
              >CANCEL</button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-white/20 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

          {/* Expand chevron */}
          {expanded
            ? <ChevronDown  className="w-3 h-3 text-white/30" />
            : <ChevronRight className="w-3 h-3 text-white/20" />}
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-3 py-3 space-y-4 bg-black/10 border-t border-white/5">

          {/* Name */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Name</span>
            <input
              type="text"
              value={zone.name}
              onChange={e => onUpdate({ name: e.target.value })}
              className="w-full bg-black/30 border border-white/5 rounded text-[10px] font-mono
                         text-white/70 px-2 py-1.5 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Zone Type</span>
            <select
              value={zone.type}
              onChange={e => {
                const newType = e.target.value as CollisionZoneType;
                const newDef = getZoneTypeDefinition(newType);
                onUpdate({
                  type: newType,
                  color: newDef.defaultColor,
                  allowedTags: [...newDef.defaultAllowedTags],
                  blockedTags: [...newDef.defaultBlockedTags],
                  allowedCategories: [...newDef.defaultAllowedCategories],
                  blockedCategories: [...newDef.defaultBlockedCategories],
                });
              }}
              className="w-full bg-black/30 border border-white/5 rounded text-[9px] font-mono
                         text-white/60 px-2 py-1.5 focus:outline-none focus:border-white/20"
            >
              {ZONE_TYPE_DEFINITIONS.map(d => (
                <option key={d.type} value={d.type}>{d.label}</option>
              ))}
            </select>
            <p className="text-[8px] text-white/25 font-mono leading-snug">{def.description}</p>
          </div>

          {/* Shape */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Shape</span>
            <div className="flex gap-1.5">
              {SHAPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ shape: opt.value })}
                  className={`flex-1 py-1.5 rounded border text-[8px] font-mono uppercase tracking-widest
                    transition-colors ${
                      zone.shape === opt.value
                        ? 'bg-white/10 border-white/20 text-white/80'
                        : 'bg-black/20 border-white/5 text-white/30 hover:border-white/15'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transform */}
          <Vec3Input
            label="Position"
            value={zone.position}
            onChange={v => onUpdate({ position: v })}
          />
          <Vec3Input
            label="Scale (half-extents)"
            value={zone.scale}
            step={0.5}
            onChange={v => onUpdate({ scale: v })}
          />

          {/* Color */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest flex-1">Color</span>
            <input
              type="color"
              value={zone.color}
              onChange={e => onUpdate({ color: e.target.value })}
              className="w-7 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
            />
            <span className="text-[9px] font-mono text-white/30">{zone.color}</span>
          </div>

          {/* Allowed Tags */}
          <TagSelect
            label="Allowed Tags"
            selected={zone.allowedTags}
            onChange={tags => onUpdate({ allowedTags: tags })}
          />

          {/* Blocked Tags */}
          <TagSelect
            label="Blocked Tags"
            selected={zone.blockedTags}
            onChange={tags => onUpdate({ blockedTags: tags })}
          />

          {/* Notes */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Notes</span>
            <textarea
              value={zone.notes ?? ''}
              onChange={e => onUpdate({ notes: e.target.value })}
              rows={2}
              placeholder="Optional description…"
              className="w-full bg-black/30 border border-white/5 rounded text-[9px] font-mono
                         text-white/60 px-2 py-1.5 focus:outline-none focus:border-white/20
                         resize-none placeholder:text-white/15"
            />
          </div>

          {/* Export to runtime toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Export to Runtime</span>
            <button
              onClick={() => onUpdate({ exportToRuntime: !zone.exportToRuntime })}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              {zone.exportToRuntime
                ? <ToggleRight className="w-4 h-4 text-blue-400" />
                : <ToggleLeft  className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Create-zone form
function CreateZoneForm({ onConfirm }: { onConfirm: (zone: CollisionZone) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CollisionZoneType>('custom');

  const handleCreate = () => {
    const trimmed = name.trim() || getZoneTypeDefinition(type).label;
    onConfirm(createZoneFromType(type, trimmed));
    setName('');
    setType('custom');
  };

  return (
    <div className="space-y-3 p-3 bg-black/20 border border-white/5 rounded">
      <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">New Zone</span>

      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Zone name…"
        className="w-full bg-black/30 border border-white/5 rounded text-[10px] font-mono
                   text-white/70 px-2 py-1.5 focus:outline-none focus:border-white/20
                   placeholder:text-white/15"
      />

      <select
        value={type}
        onChange={e => setType(e.target.value as CollisionZoneType)}
        className="w-full bg-black/30 border border-white/5 rounded text-[9px] font-mono
                   text-white/60 px-2 py-1.5 focus:outline-none focus:border-white/20"
      >
        {ZONE_TYPE_DEFINITIONS.map(d => (
          <option key={d.type} value={d.type}>{d.label}</option>
        ))}
      </select>

      <p className="text-[8px] text-white/25 font-mono leading-snug">
        {getZoneTypeDefinition(type).description}
      </p>

      <button
        onClick={handleCreate}
        className="w-full py-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20
                   rounded text-[9px] font-mono text-blue-300 uppercase tracking-widest
                   transition-colors"
      >
        Create Zone
      </button>
    </div>
  );
}

// Main panel
export default function CollisionZonePanel({
  zones,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
}: CollisionZonePanelProps) {
  const [showCreate, setShowCreate] = useState(false);

  const enabledCount = zones.filter(z => z.enabled).length;

  return (
    <div className="h-full flex flex-col bg-[#151619]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white/80">
            COLLISION_ZONES
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-white/25">
            {enabledCount}/{zones.length} ACTIVE
          </span>
          <button
            onClick={() => setShowCreate(p => !p)}
            className={`p-1 rounded transition-colors ${
              showCreate
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 hover:bg-white/10 text-white/40 border border-transparent'
            }`}
            title="Create zone"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
        {showCreate && (
          <CreateZoneForm
            onConfirm={zone => {
              onAddZone(zone);
              setShowCreate(false);
            }}
          />
        )}

        {zones.length === 0 && !showCreate && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Shield className="w-6 h-6 text-white/10" />
            <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest leading-relaxed">
              No zones defined.<br />Press + to add your first zone.
            </p>
          </div>
        )}

        {zones.map(zone => (
          <ZoneRow
            key={zone.id}
            zone={zone}
            onUpdate={updates => onUpdateZone(zone.id, updates)}
            onDelete={() => onDeleteZone(zone.id)}
          />
        ))}
      </div>

      {/* Footer info */}
      {zones.length > 0 && (
        <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-2">
          <Info className="w-3 h-3 text-white/20 flex-shrink-0" />
          <p className="text-[8px] font-mono text-white/20 leading-snug">
            Zones guide placement validation. Disabled zones are ignored.
          </p>
        </div>
      )}
    </div>
  );
}
