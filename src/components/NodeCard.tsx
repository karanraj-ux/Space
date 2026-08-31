import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ChevronLeft, ChevronRight, Loader2, Search, Scale, Lightbulb, FileText, Edit3, Scissors, Check, Image as ImageIcon, Settings, Bug } from 'lucide-react';
import { GridNodeData, NodeVersion } from '../types';

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
                   onClick={(e) => { e.stopPropagation(); onHoverCitation?.(null); /* Could center view on node here if we had the method */ }}
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
  "Searching the internet...",
  "Looking for connections...",
  "Gathering the cool bits...",
  "Brewing some ideas...",
  "Almost there..."
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
    <div className="p-8 flex flex-col items-center justify-center text-center gap-6 min-h-[400px]">
      <div className="relative h-6 w-full flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute font-mono text-sm uppercase tracking-wider text-black w-full text-center font-bold"
          >
            {LOADING_MESSAGES[index]}
          </motion.div>
        </AnimatePresence>
      </div>
      <Loader2 className="w-8 h-8 animate-spin text-black" />
      <div className="absolute -inset-2 border-2 border-dashed border-gray-200 pointer-events-none rounded opacity-50"></div>
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
  isXRayMode?: boolean;
}

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
    asciiArt: node.asciiArt,
    prompts: node.prompts
  };
  const isGenerating = node.status === 'generating';
  
  const versionText = `${index + 1}.${node.versionIndex}`;

  const nodeRef = React.useRef<HTMLDivElement>(null);

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
        // Prevent clicking internal elements from toggling selection if handled
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
        title="Connect Input"
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

      {/* Correction Port (Bottom) */}
      <div 
        className="absolute -bottom-3 left-1/2 w-6 h-6 -translate-x-1/2 bg-red-500 border-2 border-white rounded-full cursor-crosshair z-20 hover:scale-125 transition-transform flex items-center justify-center shadow-[2px_2px_0px_#000]"
        onPointerUp={(e) => {
          e.stopPropagation();
          onCorrectionDrop?.(node.id);
        }}
        title="Drop here to correct this node and trigger a ripple effect"
      >
        <div className="w-2 h-2 bg-white rounded-full pointer-events-none" />
      </div>

      {/* Node Toolbar */}
      <div 
        className="flex items-center gap-2 text-xs font-mono cursor-grab active:cursor-grabbing w-fit relative z-10"
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        <div className="bg-white border border-black rounded-full px-3 py-1.5 shadow-[2px_2px_0px_#000] flex items-center gap-3">
          <span className="font-bold">NODE {versionText}</span>
          {node.settings && (
            <span className="text-[10px] bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded ml-1 border border-yellow-400 font-bold tracking-tighter" title="Custom Settings Active">CST</span>
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
                <span className="w-8 text-center">{node.versionIndex + 1}/{node.versions.length || 1}</span>
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
              
              <span className="w-16">
                {isGenerating ? '---' : `${version.text?.length || 0} CH`}
              </span>
              
              <div className="h-3 w-px bg-gray-300"></div>
              
              <button 
                onClick={() => {
                  const selection = window.getSelection()?.toString();
                  if (selection && selection.trim().length > 0) {
                    onFracture?.(selection.trim(), node.id);
                  } else {
                    alert("Please select some text in the node first to fracture it.");
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-purple-600 transition-colors cursor-pointer"
                title="Fracture (Extract highlighted text)"
              >
                <Scissors size={14} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`hover:text-blue-600 transition-colors cursor-pointer ${isSettingsOpen ? 'text-blue-600' : ''}`}
                title="Node Settings (Persona & Capabilities)"
              >
                <Settings size={14} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onOpenDebug?.(node.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-red-600 transition-colors cursor-pointer"
                title="Execution Logs (Debug)"
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
                onClick={() => onVisualize?.(node.id)}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-pink-600 transition-colors cursor-pointer"
                title="Visualize (Generate Image)"
              >
                <ImageIcon size={14} />
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
                title="Close"
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
          className="flex flex-col shadow-[4px_4px_0px_#000] border-2 border-black rounded relative z-10"
          style={{ backgroundColor: isXRayMode ? `rgba(255, ${Math.floor(255 * (1 - Math.min(1, Math.ceil((version.text?.length || 0) / 4) / 1000)))}, ${Math.floor(255 * (1 - Math.min(1, Math.ceil((version.text?.length || 0) / 4) / 1000)))}, 0.95)` : 'white' }}
          onPointerDown={(e) => onPointerDown?.(e)}
        >
          
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
                  placeholder="e.g. Expert Copywriter, Harsh Critic" 
                  className="w-full border border-black p-1 text-xs"
                />
              </div>

              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase mb-1 text-gray-700">Capability (Doer Node)</label>
                <select 
                  value={node.settings?.capability || 'none'} 
                  onChange={(e) => onUpdateSettings?.(node.id, { ...node.settings, capability: e.target.value })}
                  className="w-full border border-black p-1 text-xs"
                >
                  <option value="none">Standard AI Text</option>
                  <option value="search">Web Search (Grounding)</option>
                </select>
              </div>
            </div>
          )}

          {isXRayMode ? (
            <div 
              className="p-4 flex flex-col gap-2 font-mono text-[10px] sm:text-xs leading-tight text-black max-h-[600px] overflow-y-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="bg-black text-white p-1 inline-block w-fit font-bold uppercase">X-RAY DIAGNOSTIC</div>
              <div><strong>NODE_ID:</strong> {node.id}</div>
              <div><strong>STATUS:</strong> {node.status}</div>
              <div><strong>TYPE:</strong> {node.type || 'standard'}</div>
              <div><strong>EST. TOKENS:</strong> {Math.ceil((version.text?.length || 0) / 4)} 
                <span className="ml-2 bg-white px-1">({Math.round(Math.min(1, Math.ceil((version.text?.length || 0) / 4) / 1000)*100)}% of typical chunk)</span>
              </div>
              <div className="border-t border-black pt-2 mt-2"><strong>PROMPT PAYLOAD:</strong></div>
              <pre className="whitespace-pre-wrap break-words bg-white/70 border border-black p-2">{node.prompt}</pre>
              <div className="border-t border-black pt-2 mt-2"><strong>INCOMING EDGES (DEPENDENCIES):</strong></div>
              <pre className="whitespace-pre-wrap break-words bg-white/70 border border-black p-2">
                {JSON.stringify(node.incomingEdges || [], null, 2)}
              </pre>
              <div className="border-t border-black pt-2 mt-2"><strong>INTERNAL STATE (VERSIONS):</strong></div>
              <pre className="whitespace-pre-wrap break-words bg-white/70 border border-black p-2">
                {JSON.stringify(node.versions.map(v => ({...v, text: v.text ? `[TEXT DATA: ${v.text.length} chars]` : null, imageUrl: v.imageUrl ? '[IMAGE DATA]' : null})), null, 2)}
              </pre>
            </div>
          ) : node.status === 'error' ? (
            <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
              <div className="text-red-500 mb-2">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              </div>
              <div className="font-mono text-sm uppercase tracking-wider text-red-500">
                SYSTEM_FAULT:<br/>NEURAL ENGINE FAILURE
              </div>
              <div className="text-xs text-gray-500 mt-2 font-mono">Unable to process prompt. Please try regenerating.</div>
              <div className="absolute -inset-2 border-2 border-dashed border-red-300 pointer-events-none rounded opacity-50"></div>
            </div>
          ) : isGenerating ? (
            <FunLoader />
          ) : (
            <>
              {/* Visual Header / Image */}
              <div className={`bg-[#f8f9fa] border-b-2 border-black overflow-hidden flex items-center justify-center relative ${version.imageUrl || (node.type === 'source' && node.fileData?.mimeType.startsWith('image/')) ? 'min-h-[300px]' : 'min-h-[200px]'}`}>
                {node.type === 'source' && node.fileData ? (
                  node.fileData.mimeType.startsWith('image/') ? (
                    <img 
                      src={node.fileData.data ? `data:${node.fileData.mimeType};base64,${node.fileData.data}` : node.fileData.localUrl} 
                      alt={node.prompt} 
                      className="w-full h-[300px] object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      <span className="font-mono text-[10px] uppercase tracking-widest">{node.fileData.mimeType.split('/').pop()} DOCUMENT</span>
                    </div>
                  )
                ) : version.imageUrl ? (
                  <img 
                    src={version.imageUrl} 
                    alt={node.prompt} 
                    className="w-full h-[300px] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : version.imageLoading ? (
                   <div className="flex flex-col items-center gap-2 py-16">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">Generating Visual Data...</span>
                   </div>
                ) : version.asciiArt ? (
                  <pre className="text-gray-800 whitespace-pre font-mono p-4 text-[10px] sm:text-xs leading-tight mx-auto">
                    {version.asciiArt}
                  </pre>
                ) : (
                  <span className="font-mono text-[10px] text-gray-400 py-16 uppercase tracking-widest">No Visual Data</span>
                )}
              </div>
              
              {/* Text Content */}
              <div 
                className="p-5 min-h-[50px] max-h-[60vh] overflow-y-auto custom-scrollbar text-sm leading-relaxed cursor-text selection:bg-yellow-200 relative group"
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={() => {
                  if (!isEditing) {
                    setEditText(version.text);
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
                           onExpand(`Focus on: "${selectedText.substring(0, 50)}..."`, node.id);
                        }}
                        className="bg-black text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
                      >
                        <Sparkles size={12} />
                        Micro-Wire Selection
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-1 mb-3">
                  <div className="flex items-center gap-2">
                    {node.parentIds && node.parentIds.length > 1 && (
                      <span className="bg-purple-100 border border-purple-800 text-purple-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-sm flex items-center gap-1 w-fit">
                        <Sparkles size={10} /> Synthesized
                      </span>
                    )}
                    {node.prompt.includes('Extract') && (
                      <span className="bg-blue-100 border border-blue-800 text-blue-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-sm flex items-center gap-1 w-fit">
                        <Search size={10} /> Extraction
                      </span>
                    )}
                    {node.prompt.includes('Critique') && (
                      <span className="bg-red-100 border border-red-800 text-red-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-sm flex items-center gap-1 w-fit">
                        <Scale size={10} /> Critique
                      </span>
                    )}
                    {node.prompt.includes('Brainstorm') && (
                      <span className="bg-green-100 border border-green-800 text-green-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-sm flex items-center gap-1 w-fit">
                        <Lightbulb size={10} /> Brainstorm
                      </span>
                    )}
                    {node.prompt.includes('Provide a concise') && (
                      <span className="bg-gray-100 border border-gray-800 text-gray-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-sm flex items-center gap-1 w-fit">
                        <FileText size={10} /> Summary
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-lg uppercase tracking-tight">{node.prompt}</h3>
                </div>
                {isEditing ? (
                  <textarea 
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => {
                      onUpdateText?.(node.id, editText);
                      setIsEditing(false);
                    }}
                    className="w-full h-full min-h-[100px] h-auto bg-transparent p-0 font-sans text-sm focus:outline-none resize-none leading-relaxed"
                    autoFocus
                  />
                ) : (
                  <div className="relative group/text">
                    {!isGenerating && (
                      <div className="absolute -top-4 right-0 opacity-0 group-hover/text:opacity-100 transition-opacity text-[10px] text-gray-400 font-mono pointer-events-none">
                        Double-click to edit
                      </div>
                    )}
                    <Typewriter text={version.text} onExpand={onExpand} nodeId={node.id} onHoverCitation={onHoverCitation} />
                  </div>
                )}
                {version.imageUrl && (
                  <div className="mt-4 border-2 border-black">
                    <img src={version.imageUrl} alt="Visual synthesis" className="w-full h-auto block" />
                  </div>
                )}
                {node.fileData && node.fileData.localUrl && (
                  <div className="mt-4 border-2 border-black p-2 bg-white">
                    {node.fileData.mimeType.startsWith('video/') ? (
                      <video src={node.fileData.localUrl} controls className="w-full h-auto block" />
                    ) : node.fileData.mimeType.startsWith('audio/') ? (
                      <audio src={node.fileData.localUrl} controls className="w-full block" />
                    ) : node.fileData.mimeType.startsWith('image/') ? (
                      <img src={node.fileData.localUrl} alt="File" className="w-full h-auto block" />
                    ) : (
                      <div className="text-xs font-mono break-all p-2 bg-gray-100">
                        {node.fileData.name || 'File Uploaded'}
                      </div>
                    )}
                    {onAutoMap && (
                      <div className="mt-4 p-2 bg-gray-50 border border-gray-200" onPointerDown={(e) => e.stopPropagation()}>
                        <div className="text-[10px] font-bold uppercase mb-2">Extraction Depth</div>
                        <input 
                          type="range" min="0" max="2" 
                          value={mapLevel === 'broad' ? 0 : mapLevel === 'detailed' ? 2 : 1} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setMapLevel(val === '0' ? 'broad' : val === '2' ? 'detailed' : 'balanced');
                          }} 
                          className="w-full" 
                        />
                        <div className="flex justify-between text-[9px] uppercase font-mono mt-1 text-gray-500">
                          <span>Broad</span><span>Balanced</span><span>Detailed</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAutoMap(node.id, mapLevel); }}
                          className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-800 p-2 text-xs font-bold uppercase tracking-wider hover:bg-blue-200 transition-colors border-2 border-black"
                        >
                          <Sparkles size={14} /> Auto-Map GraphRAG
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
      {/* Suggestions Dropdown Menu */}
      {!isGenerating && !isMinimized && version?.prompts && version.prompts.length > 0 && (
        <div className="border-t-2 border-black bg-blue-50 relative z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSuggestionsMenuOpen(!isSuggestionsMenuOpen);
            }}
            className="w-full flex items-center justify-between p-3 text-left font-bold uppercase tracking-wider text-xs text-blue-900 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} />
              AI Suggestions
            </span>
            <ChevronRight size={14} className={`transition-transform duration-200 ${isSuggestionsMenuOpen ? "rotate-90" : ""}`} />
          </button>
          
          {isSuggestionsMenuOpen && (
            <div className="flex flex-col bg-white border-t-2 border-black">
              {version.prompts.map((promptStr, i) => (
                <button
                  key={`suggest-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSuggestionsMenuOpen(false);
                    onExpand(promptStr, node.id);
                  }}
                  className="w-full flex items-start p-3 text-left hover:bg-blue-50 transition-colors text-xs font-medium text-gray-800 cursor-pointer border-b border-gray-200 last:border-b-0"
                >
                  <Sparkles size={12} className="mr-2 mt-0.5 flex-shrink-0 text-blue-600" />
                  <span className="whitespace-normal leading-relaxed break-words">{promptStr}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions Dropdown Menu (Mobile-Friendly) */}
      {!isGenerating && !isMinimized && (
        <div className="border-t-2 border-black bg-gray-50 relative z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsActionsMenuOpen(!isActionsMenuOpen);
            }}
            className="w-full flex items-center justify-between p-3 text-left font-bold uppercase tracking-wider text-xs hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} />
              Actions
            </span>
            <ChevronRight size={14} className={`transition-transform duration-200 ${isActionsMenuOpen ? "rotate-90" : ""}`} />
          </button>
          
          {isActionsMenuOpen && (
            <div className="flex flex-col bg-white border-t-2 border-black">
              {[
                { id: "extract", icon: <Search size={14} className="mr-2 text-blue-600" />, label: "Extract Data", prompt: "Extract key data points, statistics, and entities." },
                { id: "critique", icon: <Scale size={14} className="mr-2 text-red-600" />, label: "Critique", prompt: "Act as a critical reviewer. Find flaws and weaknesses." },
                { id: "brainstorm", icon: <Lightbulb size={14} className="mr-2 text-green-600" />, label: "Brainstorm", prompt: "Brainstorm out-of-the-box expansions or adjacent ideas." },
                { id: "summarize", icon: <FileText size={14} className="mr-2 text-purple-600" />, label: "Summarize", prompt: "Provide a concise, high-level summary." }
              ].map((lens) => (
                <button
                  key={lens.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsActionsMenuOpen(false);
                    onExpand(lens.prompt, node.id);
                  }}
                  className="w-full flex items-center p-3 text-left hover:bg-gray-100 transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer border-b border-gray-200 last:border-b-0"
                >
                  {lens.icon}
                  {lens.label}
                </button>
              ))}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const target = e.target as HTMLFormElement;
                  const input = target.elements.namedItem("customPrompt") as HTMLInputElement;
                  if (input.value.trim()) {
                    setIsActionsMenuOpen(false);
                    onExpand(input.value.trim(), node.id);
                    input.value = "";
                  }
                }}
                className="w-full flex items-center p-2 bg-gray-50 border-t border-gray-200"
              >
                <Sparkles size={14} className="ml-2 mr-2 text-yellow-600" />
                <input 
                  name="customPrompt"
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Ask Custom..." 
                  className="w-full p-2 text-xs font-bold uppercase tracking-wider outline-none bg-white border border-gray-300"
                />
              </form>
            </div>
          )}
        </div>
      )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};
