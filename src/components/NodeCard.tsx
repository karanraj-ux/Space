import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ChevronLeft, ChevronRight, Loader2, Search, Scale, Lightbulb, FileText, Edit3, Scissors, Check, Image as ImageIcon, Settings, Bug, ShieldAlert, CheckCircle2, FileCheck, Compass, Zap } from 'lucide-react';
import { GridNodeData, NodeVersion, NodeRole } from '../types';

import ReactMarkdown from 'react-markdown';

const Typewriter = ({ text, onExpand, nodeId, onHoverCitation }: { text: string, onExpand: (prompt: string, parentId: string) => void, nodeId: string, onHoverCitation?: (id: string | null) => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  // Pre-process text to fix bad markdown links where href has spaces
  const processedText = (text || '').replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, (match, p1, p2) => {
    return `[${p1}](${p2.replace(/\s/g, '%20')})`;
  });
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const charsPerTick = Math.max(1, Math.floor(processedText.length / 100)); // adjust speed
    const interval = setInterval(() => {
      if (i >= processedText.length) {
        clearInterval(interval);
      } else {
        setDisplayedText(processedText.slice(0, i + charsPerTick));
        i += charsPerTick;
      }
    }, 20);
    return () => clearInterval(interval);
  }, [processedText]);

  return (
    <div className="whitespace-pre-wrap">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => {
            const href = props.href || "";
            if (href.startsWith('#node-')) {
               const targetId = href.substring(1);
               return (
                 <button
                   type="button"
                   className="font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded text-[10px] mx-1 inline-flex items-center gap-1 shadow-sm border border-blue-300 hover:bg-blue-200 transition-colors"
                   onMouseEnter={() => onHoverCitation?.(targetId)}
                   onMouseLeave={() => onHoverCitation?.(null)}
                   onClick={(e) => { e.stopPropagation(); onHoverCitation?.(null); }}
                 >
                   <Search size={10} />
                   {props.children}
                 </button>
               );
            }
            return (
              <button 
                type="button"
                className="font-bold underline decoration-black decoration-2 hover:bg-yellow-200 transition-colors mx-1 inline"
                onClick={(e) => {
                  e.stopPropagation();
                  let promptText = href;
                  if (promptText.startsWith('#')) promptText = promptText.substring(1);
                  promptText = decodeURIComponent(promptText);
                  
                  if (Array.isArray(props.children) && typeof props.children[0] === 'string') {
                    promptText = props.children[0];
                  } else if (typeof props.children === 'string') {
                    promptText = props.children;
                  }
                  onExpand(promptText, nodeId);
                }}
              >
                {props.children}
              </button>
            )
          }
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

const LOADING_MESSAGES = [
  "Evaluating logical constraints...",
  "Searching vector memory index...",
  "Stress-testing premises...",
  "Cross-examining evidence...",
  "Synthesizing argument tree..."
];

const FunLoader = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 flex flex-col items-center justify-center text-center gap-6 min-h-[220px]">
      <div className="relative h-6 w-full flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute font-mono text-xs uppercase tracking-wider text-black w-full text-center font-bold"
          >
            {LOADING_MESSAGES[index]}
          </motion.div>
        </AnimatePresence>
      </div>
      <Loader2 className="w-6 h-6 animate-spin text-black" />
    </div>
  );
};

interface NodeCardProps {
  index: number;
  node: GridNodeData;
  selected?: boolean;
  highlighted?: boolean;
  onHoverCitation?: (nodeId: string | null) => void;
  onSelect?: (e: React.MouseEvent, nodeId: string) => void;
  onExpand: (prompt: string, parentId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onClose: (nodeId: string) => void;
  setVersion: (nodeId: string, versionIndex: number) => void;
  onUpdateText?: (nodeId: string, newText: string) => void;
  onFracture?: (text: string, parentId: string) => void;
  onVisualize?: (nodeId: string) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPortDragStart?: (e: React.PointerEvent, nodeId: string) => void;
  onPortDrop?: (nodeId: string) => void;
  onCorrectionDrop?: (nodeId: string) => void;
  onAutoMap?: (nodeId: string, level: string) => void;
  onUpdateSettings?: (nodeId: string, settings: any) => void;
  onOpenDebug?: (nodeId: string) => void;
  onStressTest?: (nodeId: string) => void;
  onSynthesizeBranch?: (nodeId: string) => void;
  onFindEvidence?: (nodeId: string) => void;
  onAlternateHypothesis?: (nodeId: string) => void;
  onChangeRole?: (nodeId: string, role: NodeRole) => void;
  isXRayMode?: boolean;
}

const getRoleConfig = (role?: NodeRole, prompt?: string) => {
  let effectiveRole: NodeRole = role || 'standard';
  if (!role || role === 'standard') {
    const p = (prompt || '').toLowerCase();
    if (p.includes('stress-test') || p.includes('devil') || p.includes('critique') || p.includes('flaw') || p.includes('counter-argument') || p.includes('risk')) {
      effectiveRole = 'stress_test';
    } else if (p.includes('decision') || p.includes('verdict') || p.includes('synthesize') || p.includes('resolution') || p.includes('recommendation')) {
      effectiveRole = 'decision';
    } else if (p.includes('evidence') || p.includes('source of truth') || p.includes('ground truth') || p.includes('extract data') || p.includes('citation')) {
      effectiveRole = 'evidence';
    } else {
      effectiveRole = 'hypothesis';
    }
  }

  switch (effectiveRole) {
    case 'stress_test':
      return {
        role: 'stress_test' as NodeRole,
        label: "⚡ Adversarial Stress-Test",
        icon: <ShieldAlert size={13} className="text-rose-600 shrink-0" />,
        headerBg: 'bg-rose-50 text-rose-950 border-rose-300',
        cardBorder: 'border-rose-600 shadow-[4px_4px_0px_#e11d48]',
        badgeBg: 'bg-rose-100 text-rose-900 border-rose-400'
      };
    case 'decision':
      return {
        role: 'decision' as NodeRole,
        label: "🎯 Synthesized Decision",
        icon: <CheckCircle2 size={13} className="text-amber-700 shrink-0" />,
        headerBg: 'bg-amber-50 text-amber-950 border-amber-300',
        cardBorder: 'border-amber-600 shadow-[4px_4px_0px_#d97706]',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-400'
      };
    case 'evidence':
      return {
        role: 'evidence' as NodeRole,
        label: "📄 Ground Truth Evidence",
        icon: <FileCheck size={13} className="text-cyan-700 shrink-0" />,
        headerBg: 'bg-cyan-50 text-cyan-950 border-cyan-300',
        cardBorder: 'border-cyan-700 shadow-[4px_4px_0px_#0891b2]',
        badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-400'
      };
    case 'hypothesis':
    default:
      return {
        role: 'hypothesis' as NodeRole,
        label: "💡 Hypothesis / Premise",
        icon: <Compass size={13} className="text-indigo-600 shrink-0" />,
        headerBg: 'bg-indigo-50/70 text-indigo-950 border-indigo-200',
        cardBorder: 'border-black shadow-[4px_4px_0px_#000]',
        badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300'
      };
  }
};

export const NodeCard: React.FC<NodeCardProps> = ({ 
  index,
  node, 
  selected,
  highlighted,
  onHoverCitation,
  onSelect,
  onExpand, 
  onRegenerate, 
  onClose,
  setVersion,
  onUpdateText,
  onFracture,
  onVisualize,
  onPointerDown,
  onPortDragStart,
  onPortDrop,
  onCorrectionDrop,
  onAutoMap,
  onUpdateSettings,
  onOpenDebug,
  onStressTest,
  onSynthesizeBranch,
  onFindEvidence,
  onAlternateHypothesis,
  onChangeRole,
  isXRayMode
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isSuggestionsMenuOpen, setIsSuggestionsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapLevel, setMapLevel] = useState<'broad'|'balanced'|'detailed'>('balanced');
  const [editText, setEditText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const currentVersion = node.versions[node.versionIndex];
  const version: NodeVersion = currentVersion || {
    text: node.text || '',
    prompt: node.prompt,
    prompts: node.prompts
  };
  const isGenerating = node.status === 'generating';
  
  const versionText = `${index + 1}.${node.versionIndex}`;
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const roleConfig = getRoleConfig(node.role, node.prompt);

  useEffect(() => {
    const handleGlobalSelection = () => {
      const selection = window.getSelection();
      if (!selection || !selection.toString().trim()) {
        setSelectedText('');
      } else if (nodeRef.current && selection.anchorNode && nodeRef.current.contains(selection.anchorNode)) {
        setSelectedText(selection.toString().trim());
      }
    };
    document.addEventListener('selectionchange', handleGlobalSelection);
    return () => document.removeEventListener('selectionchange', handleGlobalSelection);
  }, []);

  return (
    <motion.div
      ref={nodeRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: isMinimized ? 250 : node.width,
        zIndex: highlighted ? 50 : 10
      }}
      className={`flex flex-col gap-2 origin-top-left group transition-all duration-300 ${selected ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-black rounded-sm' : ''} ${highlighted ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-white shadow-[0_0_30px_rgba(59,130,246,0.5)] rounded-sm scale-[1.02]' : ''}`}
      onClick={(e) => {
        onSelect?.(e, node.id);
      }}
    >
      {/* Input Port (Left) */}
      <div 
        className="absolute top-1/2 -left-3 w-6 h-6 -translate-y-1/2 bg-white border-2 border-black rounded-full cursor-crosshair z-20 hover:scale-125 transition-transform flex items-center justify-center shadow-[2px_2px_0px_#000]"
        onPointerUp={(e) => {
          e.stopPropagation();
          onPortDrop?.(node.id);
        }}
        title="Connect Input (Evidence / Premise Source)"
      >
        <div className="w-2 h-2 bg-black rounded-full pointer-events-none" />
      </div>

      {/* Output Port (Right) */}
      <div 
        className="absolute top-1/2 -right-3 w-6 h-6 -translate-y-1/2 bg-black border-2 border-white rounded-full cursor-crosshair z-20 hover:scale-125 transition-transform flex items-center justify-center shadow-[2px_2px_0px_#000]"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPortDragStart?.(e, node.id);
        }}
        title="Drag to Connect Output"
      >
        <div className="w-2 h-2 bg-white rounded-full pointer-events-none" />
      </div>

      {/* Correction / Devil's Advocate Port (Bottom) */}
      <div 
        className="absolute -bottom-3 left-1/2 w-6 h-6 -translate-x-1/2 bg-rose-600 border-2 border-white rounded-full cursor-crosshair z-20 hover:scale-125 transition-transform flex items-center justify-center shadow-[2px_2px_0px_#000]"
        onPointerUp={(e) => {
          e.stopPropagation();
          onCorrectionDrop?.(node.id);
        }}
        title="Drop here to inject Adversarial Correction and ripple forward"
      >
        <div className="w-2 h-2 bg-white rounded-full pointer-events-none" />
      </div>

      {/* Node Toolbar */}
      <div 
        className="flex items-center gap-2 text-xs font-mono cursor-grab active:cursor-grabbing w-fit relative z-10"
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        <div className="bg-white border border-black rounded-full px-3 py-1.5 shadow-[2px_2px_0px_#000] flex items-center gap-2">
          <span className="font-bold">NODE {versionText}</span>
          
          {node.settings && (
            <span className="text-[10px] bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded border border-yellow-400 font-bold tracking-tighter" title="Custom Settings Active">CST</span>
          )}
          {node.memorySnapshot && (
            <span className="text-[10px] bg-purple-200 text-purple-900 px-1 py-0.5 rounded border border-purple-400 font-bold tracking-tighter flex items-center gap-1" title="Memory Compressed">
              COMPRESSED
            </span>
          )}
          
          <div className="h-3 w-px bg-gray-300"></div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="hover:bg-gray-100 p-0.5 rounded cursor-pointer"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              <div className="w-3 h-[2px] bg-black rounded" />
            </button>
          </div>
          
          {!isMinimized && (
            <>
              <div className="h-3 w-px bg-gray-300"></div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setVersion(node.id, Math.max(0, node.versionIndex - 1))}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={node.versionIndex === 0}
                  className="hover:bg-gray-100 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="w-8 text-center text-[10px]">{node.versionIndex + 1}/{node.versions.length || 1}</span>
                <button 
                  onClick={() => setVersion(node.id, Math.min(node.versions.length - 1, node.versionIndex + 1))}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={node.versionIndex === node.versions.length - 1}
                  className="hover:bg-gray-100 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              
              <div className="h-3 w-px bg-gray-300"></div>
              
              <button 
                onClick={() => {
                  const selection = window.getSelection()?.toString();
                  if (selection && selection.trim().length > 0) {
                    onFracture?.(selection.trim(), node.id);
                  } else {
                    alert("Please select some text in the node first to extract it.");
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-purple-600 transition-colors cursor-pointer"
                title="Fracture / Extract highlighted text"
              >
                <Scissors size={14} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`hover:text-blue-600 transition-colors cursor-pointer ${isSettingsOpen ? 'text-blue-600' : ''}`}
                title="Node Settings & Persona"
              >
                <Settings size={14} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onOpenDebug?.(node.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-red-600 transition-colors cursor-pointer"
                title="Audit Log & Vector Hits"
              >
                <Bug size={14} />
              </button>

              <button 
                onClick={() => {
                  if (isEditing) {
                    onUpdateText?.(node.id, editText);
                    setIsEditing(false);
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`transition-colors cursor-pointer ${isEditing ? 'text-green-600' : 'hidden'}`}
                title="Save Edits"
              >
                <Check size={14} />
              </button>
              
              <button 
                onClick={() => onRegenerate(node.id)}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-blue-600 transition-colors cursor-pointer"
                title="Regenerate"
              >
                <Sparkles size={14} />
              </button>
              
              <button 
                onClick={() => onClose(node.id)}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-red-600 transition-colors cursor-pointer"
                title="Delete Node"
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      {!isMinimized && (
        <div 
          className={`flex flex-col border-2 rounded relative z-10 overflow-hidden bg-white ${roleConfig.cardBorder}`}
          onPointerDown={(e) => onPointerDown?.(e)}
        >
          {/* Epistemic Role Header */}
          <div className={`px-3 py-2 border-b-2 border-black flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider ${roleConfig.headerBg}`}>
            <div className="flex items-center gap-1.5">
              {roleConfig.icon}
              <span className="text-[11px]">{roleConfig.label}</span>
              {node.confidenceScore && (
                <span className="bg-black text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-normal">
                  {node.confidenceScore}% CONFIDENCE
                </span>
              )}
            </div>
            
            <select
              value={roleConfig.role}
              onChange={(e) => {
                e.stopPropagation();
                onChangeRole?.(node.id, e.target.value as NodeRole);
              }}
              className="bg-white/80 hover:bg-white text-[10px] font-mono px-1 py-0.5 rounded border border-black/20 outline-none cursor-pointer"
              title="Change Epistemic Role"
            >
              <option value="hypothesis">💡 Hypothesis</option>
              <option value="stress_test">⚡ Stress-Test</option>
              <option value="evidence">📄 Evidence</option>
              <option value="decision">🎯 Decision</option>
            </select>
          </div>

          {/* Stacked effect base lines if multiple versions */}
          {node.versions.length > 1 && !isXRayMode && (
            <>
              <div className="absolute top-1 -right-1.5 w-full h-full border-r-2 border-t-2 border-black rounded bg-white -z-10 shadow-[2px_2px_0px_#000]" />
              <div className="absolute top-2 -right-3 w-full h-full border-r-2 border-t-2 border-black rounded bg-white -z-20 shadow-[2px_2px_0px_#000]" />
            </>
          )}

          {isSettingsOpen && (
            <div 
              className="p-3 bg-blue-50 border-b-2 border-black text-xs" 
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="font-bold uppercase tracking-wider mb-2 flex items-center gap-1 text-blue-900">
                <Settings size={14} /> Node Settings
              </div>
              
              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase mb-1 text-gray-700">Persona / Role</label>
                <input 
                  type="text" 
                  value={node.settings?.persona || ''} 
                  onChange={(e) => onUpdateSettings?.(node.id, { ...node.settings, persona: e.target.value })}
                  placeholder="e.g. Ruthless Auditor, Contrarian Venture Capitalist" 
                  className="w-full border border-black p-1 text-xs"
                />
              </div>

              <div className="mb-2">
                <label className="block text-[10px] font-bold uppercase mb-1 text-gray-700">Capability</label>
                <select 
                  value={node.settings?.capability || 'none'} 
                  onChange={(e) => onUpdateSettings?.(node.id, { ...node.settings, capability: e.target.value })}
                  className="w-full border border-black p-1 text-xs bg-white"
                >
                  <option value="none">Standard Factual Model</option>
                  <option value="search">Web Search Grounding</option>
                </select>
              </div>
            </div>
          )}

          {isXRayMode ? (
            <div 
              className="p-4 flex flex-col gap-2 font-mono text-[10px] leading-tight text-black max-h-[500px] overflow-y-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="bg-black text-white p-1 inline-block w-fit font-bold uppercase">X-RAY COGNITIVE DIAGNOSTIC</div>
              <div><strong>ROLE:</strong> {roleConfig.role.toUpperCase()}</div>
              <div><strong>NODE_ID:</strong> {node.id}</div>
              <div><strong>STATUS:</strong> {node.status}</div>
              <div><strong>EST. TOKENS:</strong> {Math.ceil((version.text?.length || 0) / 4)}</div>
              <div className="border-t border-black pt-2 mt-2"><strong>PROMPT:</strong></div>
              <pre className="whitespace-pre-wrap break-words bg-white/70 border border-black p-2">{node.prompt}</pre>
              <div className="border-t border-black pt-2 mt-2"><strong>INCOMING EDGES:</strong></div>
              <pre className="whitespace-pre-wrap break-words bg-white/70 border border-black p-2">
                {JSON.stringify(node.incomingEdges || [], null, 2)}
              </pre>
            </div>
          ) : node.status === 'error' ? (
            <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[220px]">
              <div className="text-red-500 mb-2">
                <ShieldAlert size={36} />
              </div>
              <div className="font-mono text-xs uppercase tracking-wider text-red-500 font-bold">
                REASONING PIPELINE FAULT
              </div>
              <div className="text-xs text-gray-500 font-mono">Unable to complete node. Please click regenerate.</div>
            </div>
          ) : isGenerating ? (
            <FunLoader />
          ) : (
            <>
              {/* Optional Visual File Header if user uploaded a media file or generated an image */}
              {(version.imageUrl || (node.type === 'source' && node.fileData)) && (
                <div className="bg-gray-50 border-b-2 border-black overflow-hidden flex items-center justify-center relative max-h-[260px]">
                  {node.fileData?.mimeType.startsWith('image/') ? (
                    <img 
                      src={node.fileData.data ? `data:${node.fileData.mimeType};base64,${node.fileData.data}` : node.fileData.localUrl} 
                      alt={node.prompt} 
                      className="w-full h-[240px] object-cover"
                    />
                  ) : version.imageUrl ? (
                    <img 
                      src={version.imageUrl} 
                      alt={node.prompt} 
                      className="w-full h-[240px] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center gap-2 py-6 text-gray-600 font-mono text-xs">
                      <FileText size={20} />
                      <span className="font-bold">{node.fileData?.name || 'Document Attached'}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Text Content */}
              <div 
                className="p-4 min-h-[50px] max-h-[55vh] overflow-y-auto custom-scrollbar text-sm leading-relaxed cursor-text selection:bg-yellow-200 relative group"
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={() => {
                  if (!isEditing) {
                    setEditText(version.text || '');
                    setIsEditing(true);
                  }
                }}
              >
                {/* Micro-wiring floating button */}
                <AnimatePresence>
                  {selectedText && !isEditing && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="sticky bottom-4 z-50 flex justify-center w-full mt-4"
                    >
                      <button
                        onPointerDown={(e) => {
                           e.preventDefault(); 
                           e.stopPropagation();
                           onExpand(`Focus on quote: "${selectedText.substring(0, 60)}..."`, node.id);
                        }}
                        className="bg-black text-white px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
                      >
                        <Zap size={12} className="text-yellow-400" />
                        Micro-Wire Selection
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-1 mb-2">
                  <h3 className="font-bold text-base tracking-tight text-gray-900">{node.prompt}</h3>
                </div>

                {isEditing ? (
                  <textarea 
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => {
                      onUpdateText?.(node.id, editText);
                      setIsEditing(false);
                    }}
                    className="w-full h-full min-h-[120px] bg-yellow-50/50 p-2 border border-black font-sans text-sm focus:outline-none resize-none leading-relaxed"
                    autoFocus
                  />
                ) : (
                  <div className="relative group/text text-gray-800 text-[13px] leading-relaxed">
                    {!isGenerating && (
                      <div className="absolute -top-4 right-0 opacity-0 group-hover/text:opacity-100 transition-opacity text-[10px] text-gray-400 font-mono pointer-events-none">
                        Double-click to edit
                      </div>
                    )}
                    <Typewriter text={version.text || ''} onExpand={onExpand} nodeId={node.id} onHoverCitation={onHoverCitation} />
                  </div>
                )}

                {node.fileData && node.fileData.localUrl && !node.fileData.mimeType.startsWith('image/') && (
                  <div className="mt-3 border border-gray-300 p-2 bg-gray-50 text-xs font-mono">
                    <span className="font-bold text-gray-700">{node.fileData.name || 'File Attachment'}</span>
                    {onAutoMap && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAutoMap(node.id, mapLevel); }}
                        className="mt-2 w-full flex items-center justify-center gap-1 bg-cyan-100 text-cyan-900 p-1.5 text-xs font-bold uppercase tracking-wider hover:bg-cyan-200 transition-colors border border-black"
                      >
                        <Sparkles size={12} /> Auto-Map Semantic Graph
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Suggestions Dropdown Menu */}
              {!isGenerating && !isMinimized && version?.prompts && version.prompts.length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50/70">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSuggestionsMenuOpen(!isSuggestionsMenuOpen);
                    }}
                    className="w-full flex items-center justify-between p-2.5 text-left font-bold uppercase tracking-wider text-[10px] font-mono text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-yellow-600" />
                      Suggested Trajectories ({version.prompts.length})
                    </span>
                    <ChevronRight size={12} className={`transition-transform duration-200 ${isSuggestionsMenuOpen ? "rotate-90" : ""}`} />
                  </button>
                  
                  {isSuggestionsMenuOpen && (
                    <div className="flex flex-col bg-white border-t border-gray-200">
                      {version.prompts.map((promptStr, i) => (
                        <button
                          key={`suggest-${i}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSuggestionsMenuOpen(false);
                            onExpand(promptStr, node.id);
                          }}
                          className="w-full flex items-start p-2.5 text-left hover:bg-indigo-50/50 transition-colors text-xs text-gray-800 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <ChevronRight size={12} className="mr-1.5 mt-0.5 shrink-0 text-gray-400" />
                          <span className="leading-snug">{promptStr}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EPISTEMIC REASONING OPERATORS (THE UNFAIR SUPERPOWER) */}
              {!isGenerating && !isMinimized && (
                <div className="border-t-2 border-black bg-slate-50 p-1.5 grid grid-cols-4 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStressTest?.(node.id); }}
                    className="bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border border-rose-300 hover:border-rose-600 rounded px-1.5 py-1.5 text-[10px] font-mono font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all"
                    title="Run Devil's Advocate Stress-Test"
                  >
                    <ShieldAlert size={13} className="text-rose-600" />
                    <span>Stress-Test</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFindEvidence?.(node.id); }}
                    className="bg-white hover:bg-cyan-50 text-cyan-800 hover:text-cyan-950 border border-cyan-300 hover:border-cyan-600 rounded px-1.5 py-1.5 text-[10px] font-mono font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all"
                    title="Retrieve Vector Grounding Evidence"
                  >
                    <FileCheck size={13} className="text-cyan-600" />
                    <span>Evidence</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAlternateHypothesis?.(node.id); }}
                    className="bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-indigo-300 hover:border-indigo-600 rounded px-1.5 py-1.5 text-[10px] font-mono font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all"
                    title="Branch Alternate Hypothesis"
                  >
                    <Compass size={13} className="text-indigo-600" />
                    <span>Alternate</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSynthesizeBranch?.(node.id); }}
                    className="bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-600 rounded px-1.5 py-1.5 text-[10px] font-mono font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all"
                    title="Synthesize Decision Verdict with Confidence"
                  >
                    <CheckCircle2 size={13} className="text-amber-800" />
                    <span>Decide</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};
