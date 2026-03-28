import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Check, X, ArrowRight, Layers, Box, Maximize, Move, Info } from 'lucide-react';
import { ModelData } from '../App';
import { AssetAnalysis, analyzeAsset } from '../services/AssetAnalyzer';
import { ReplacementAnalysis, analyzeReplacement } from '../services/AssetReplacementService';
import { Asset } from '../types/assets';

interface AssetReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ModelData | null;
  newAsset: Asset | null;
  onConfirm: (
    newAsset: Asset, 
    scaleMultiplier: [number, number, number], 
    positionOffset: [number, number, number],
    materialRemap: { [oldMat: string]: string }
  ) => void;
}

export default function AssetReplacementModal({ isOpen, onClose, currentModel, newAsset, onConfirm }: AssetReplacementModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ReplacementAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentModel && newAsset) {
      runAnalysis();
    } else {
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen, currentModel, newAsset]);

  const runAnalysis = async () => {
    if (!currentModel || !newAsset) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // 1. Analyze current asset
      const currentUrl = currentModel.file || currentModel.url;
      const currentAnalysis = await analyzeAsset(currentUrl);

      // 2. Analyze new asset
      const newUrl = newAsset.file || newAsset.url;
      const newAnalysis = await analyzeAsset(newUrl);

      // 3. Ask AI for replacement logic
      const result = await analyzeReplacement(currentModel, currentAnalysis, newAsset.metadata, newAnalysis);
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze assets. You can still replace, but manual adjustments will be needed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = () => {
    if (!newAsset) return;
    onConfirm(
      newAsset, 
      analysis?.scaleMultiplier || [1, 1, 1], 
      analysis?.positionOffset || [0, 0, 0],
      analysis?.materialRemap || {}
    );
    onClose();
  };

  if (!isOpen || !currentModel || !newAsset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#151619] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-mono font-bold text-white tracking-widest uppercase">Asset Replacement & Logic Inheritance</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header: Old -> New */}
          <div className="flex items-center justify-between bg-black/40 p-4 rounded-lg border border-white/5">
            <div className="flex-1 text-center">
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Current Asset</span>
              <span className="text-sm font-medium text-white">{currentModel.name}</span>
            </div>
            <ArrowRight className="w-6 h-6 text-white/20 mx-4" />
            <div className="flex-1 text-center">
              <span className="text-[10px] font-mono text-blue-400/60 uppercase block mb-1">New Asset</span>
              <span className="text-sm font-medium text-blue-400">{newAsset.metadata.name}</span>
            </div>
          </div>

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-blue-500/20 rounded-full animate-ping absolute inset-0"></div>
                <div className="w-12 h-12 border-2 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-xs font-mono text-white/50 uppercase tracking-widest">AI Analyzing Asset Differences...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* AI Explanation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/70">
                  <Info className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider">AI Analysis</h3>
                </div>
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                  <p className="text-sm text-blue-100/80 leading-relaxed">{analysis.explanation}</p>
                </div>
              </div>

              {/* Preserved Logic */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/70">
                  <Check className="w-4 h-4 text-green-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider">Preserved Scene Logic</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.preservedLogic.map((logic, i) => (
                    <span key={i} className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-300 text-[10px] font-mono uppercase rounded">
                      {logic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {analysis.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-white/70">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <h3 className="text-xs font-mono uppercase tracking-wider">Warnings & Manual Adjustments</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.warnings.map((warning, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-yellow-200/80 bg-yellow-500/5 p-3 rounded border border-yellow-500/10">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Adjustments */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/70">
                  <Box className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider">Suggested Adjustments</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-white/50">
                      <Maximize className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase">Scale Multiplier</span>
                    </div>
                    <div className="font-mono text-xs text-white">
                      [ {analysis.scaleMultiplier.map(n => n.toFixed(2)).join(', ')} ]
                    </div>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-white/50">
                      <Move className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase">Position Offset</span>
                    </div>
                    <div className="font-mono text-xs text-white">
                      [ {analysis.positionOffset.map(n => n.toFixed(2)).join(', ')} ]
                    </div>
                  </div>
                </div>
              </div>

              {/* Material Remap */}
              {Object.keys(analysis.materialRemap).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-white/70">
                    <Layers className="w-4 h-4 text-pink-400" />
                    <h3 className="text-xs font-mono uppercase tracking-wider">Material Remapping</h3>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-lg overflow-hidden">
                    {Object.entries(analysis.materialRemap).map(([oldMat, newMat], i) => (
                      <div key={i} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0">
                        <span className="text-xs font-mono text-white/60">{oldMat}</span>
                        <ArrowRight className="w-3 h-3 text-white/20" />
                        <span className="text-xs font-mono text-pink-300">{newMat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isAnalyzing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAnalyzing ? 'Analyzing...' : 'Confirm Replacement'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
