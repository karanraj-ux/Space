import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, Scale, Lightbulb, FileText, ChevronRight, Search, Play, Sparkles, ZoomIn, ZoomOut, MessageSquare, Share, Paperclip, Download, Upload, Settings, X, History, Save, Clock, Trash2, Bug, ShieldAlert, CheckCircle2, FileCheck, Compass, Zap, Copy, Check } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { GridNodeData, EdgeType, FrameData, EdgeConnection, NodeVersion, Checkpoint, NodeRole } from './types';
import { vectorMemoryStore, retrieveRelevantChunks } from './lib/vectorStore';
import { NodeCard } from './components/NodeCard';
import { ConnectingLines, WireDragState } from './components/ConnectingLines';
import { Minimap } from './components/Minimap';
import { LatencyChart } from './components/LatencyChart';
import { motion, AnimatePresence } from 'motion/react';

const NODE_WIDTH = typeof window !== 'undefined' && window.innerWidth < 768 ? 320 : 400;

export default function App() {
  const [nodes, setNodes] = useState<GridNodeData[]>([]);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const nodesRef = useRef<GridNodeData[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDecisionBriefOpen, setIsDecisionBriefOpen] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);
  const [customNodeConfig, setCustomNodeConfig] = useState({
    prompt: "",
    customModel: "",
    persona: "",
    isolateContext: false
  });
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [hasLinkedKey, setHasLinkedKey] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // Canvas Transform State
  const [transform, setTransform] = useState({ 
    x: 0, 
    y: 0, 
    scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 0.85 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isSpacePanMode, setIsSpacePanMode] = useState(false);
  const dragStartInfo = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragStartInfo = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // Wire dragging state
  const [wireDragState, setWireDragState] = useState<WireDragState | null>(null);

  // Focus tracking
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isXRayMode, setIsXRayMode] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Settings
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCheckpointsOpen, setIsCheckpointsOpen] = useState(false);
  const [debugNodeId, setDebugNodeId] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [apiKeys, setApiKeys] = useState({ gemini: '', openai: '', anthropic: '', groq: '' });
  const [selectedTextModel, setSelectedTextModel] = useState('gemini|gemini-3.1-flash-lite');
  const [selectedImageModel, setSelectedImageModel] = useState('gemini|imagen-3.0-generate-002');

  // Persistence (Load)
  useEffect(() => {
    const keys = {
      gemini: localStorage.getItem('gemini-api-key') || '',
      openai: localStorage.getItem('openai-api-key') || '',
      anthropic: localStorage.getItem('anthropic-api-key') || '',
      groq: localStorage.getItem('groq-api-key') || ''
    };
    setApiKeys(keys);
    const txtModel = localStorage.getItem('selected-text-model');
    if (txtModel) setSelectedTextModel(txtModel);
    const imgModel = localStorage.getItem('selected-image-model');
    if (imgModel) setSelectedImageModel(imgModel);

    get('gridscape-checkpoints').then((val) => {
      if (val) setCheckpoints(val);
    }).catch(err => console.error("Failed to load checkpoints", err));

    get('gridscape-nodes').then((val) => {
      if (val) {
        // Reset any stuck generating nodes to error
        const cleanNodes = val.map((n: GridNodeData) => 
          n.status === 'generating' ? { ...n, status: 'error' } : n
        );
        setNodes(cleanNodes);
        vectorMemoryStore.syncFromNodes(cleanNodes).catch(err => console.warn("Failed to sync vector memory", err));
      }
    }).catch(err => console.error("Failed to load state", err));

    get('gridscape-frames').then((val) => {
      if (val) setFrames(val);
      setIsLoaded(true);
    }).catch(err => {
      console.error("Failed to load frames", err);
      setIsLoaded(true);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePanMode(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePanMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Persistence (Save)
  useEffect(() => {
    if (isLoaded) {
      set('gridscape-nodes', nodes).catch(err => console.error("Failed to save state", err));
      set('gridscape-frames', frames).catch(err => console.error("Failed to save frames", err));
    }
  }, [nodes, frames, isLoaded]);

  const handleExportBriefcase = () => {
    const briefcase = {
      nodes,
      frames,
      transform,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(briefcase, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-briefcase-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBriefcase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.nodes) setNodes(json.nodes);
        if (json.frames) setFrames(json.frames);
        if (json.transform) setTransform(json.transform);
        setIsMainMenuOpen(false);
      } catch (err) {
        console.error("Failed to parse briefcase:", err);
        alert("Invalid briefcase file.");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleSaveCheckpoint = () => {
    const newCheckpoint: Checkpoint = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: `Snapshot ${new Date().toLocaleTimeString()}`,
      nodes: JSON.parse(JSON.stringify(nodes)),
      frames: JSON.parse(JSON.stringify(frames)),
    };
    const updated = [newCheckpoint, ...checkpoints];
    setCheckpoints(updated);
    set('gridscape-checkpoints', updated).catch(err => console.error("Failed to save checkpoints", err));
  };

  const handleRestoreCheckpoint = (cp: Checkpoint) => {
    if (window.confirm(`Are you sure you want to restore to "${cp.name}"? Current unsaved changes will be lost.`)) {
      setNodes(JSON.parse(JSON.stringify(cp.nodes)));
      setFrames(JSON.parse(JSON.stringify(cp.frames)));
      vectorMemoryStore.syncFromNodes(cp.nodes).catch(err => console.warn("Failed to sync vector memory on restore", err));
      setIsCheckpointsOpen(false);
    }
  };

  const handleDeleteCheckpoint = (id: string) => {
    if (window.confirm("Delete this checkpoint permanently?")) {
      const updated = checkpoints.filter(c => c.id !== id);
      setCheckpoints(updated);
      set('gridscape-checkpoints', updated).catch(err => console.error("Failed to delete checkpoint", err));
    }
  };

  // Panning Support
  const handlePointerDown = (e: React.PointerEvent) => {
    const isMiddleClick = e.button === 1;
    const isBgClick = e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg');
    
    if (isMiddleClick || (isSpacePanMode && e.button === 0) || (e.button === 0 && isBgClick)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartInfo.current = {
        x: e.clientX,
        y: e.clientY,
        transformX: transform.x,
        transformY: transform.y,
      };
      // prevent selection while dragging
      e.preventDefault();
    }
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    // Only allow drag if clicking the header or specific handle, handled by the event target in NodeCard
    e.stopPropagation();
    // Capture pointer on the element being grabbed so fast drags don't break
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    nodeDragStartInfo.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  const handleNodeSelect = (e: React.MouseEvent, nodeId: string) => {
    if (e.shiftKey || isMultiSelectMode) {
      setSelectedNodeIds(prev => {
        if (prev.includes(nodeId)) {
          return prev.filter(id => id !== nodeId);
        } else {
          return [...prev, nodeId];
        }
      });
    } else {
      setSelectedNodeIds([nodeId]);
    }
  };

  const handleCreateFrame = () => {
    if (selectedNodeIds.length < 2) return;
    
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    selectedNodes.forEach(node => {
      if (node.x < minX) minX = node.x;
      if (node.x + node.width > maxX) maxX = node.x + node.width;
      if (node.y < minY) minY = node.y;
      if (node.y + 400 > maxY) maxY = node.y + 400; // estimated height
    });

    const padding = 40;
    const newFrame: FrameData = {
      id: `frame-${Date.now()}`,
      title: 'New Frame',
      nodeIds: [...selectedNodeIds],
      collapsed: false,
      x: minX - padding,
      y: minY - padding - 40, // extra for header
      width: (maxX - minX) + (padding * 2),
      height: (maxY - minY) + (padding * 2) + 40
    };
    
    setFrames([...frames, newFrame]);
    setSelectedNodeIds([]); // Clear selection
  };

  const handleSynthesize = () => {
    if (selectedNodeIds.length < 2) return;
    
    // Calculate bounding box of selected nodes
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    selectedNodes.forEach(node => {
      if (node.x < minX) minX = node.x;
      if (node.x + node.width > maxX) maxX = node.x + node.width;
      if (node.y < minY) minY = node.y;
      if (node.y + 400 > maxY) maxY = node.y + 400; // estimated height
    });
    
    const midX = (minX + maxX) / 2;
    const spawnX = maxX + 400; // Spawn to the right of the rightmost node
    const spawnY = (minY + maxY) / 2; // Vertically aligned with center of bounding box
    
    const prompt = `Synthesize concepts from ${selectedNodeIds.length} nodes`;
    const incomingEdges = selectedNodeIds.map(id => ({ sourceId: id, type: 'default' as EdgeType }));
    generateNode(prompt, spawnX, spawnY, incomingEdges);
    setSelectedNodeIds([]); // Clear selection after synthesis
  };

  const handlePortDragStart = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const startX = node.x + node.width;
    const startY = node.y + Math.min(200, node.fileData || node.versions[0]?.imageUrl ? 150 : 100); 

    const canvasX = (e.clientX - transform.x) / transform.scale;
    const canvasY = (e.clientY - transform.y) / transform.scale;

    setWireDragState({
      sourceId: nodeId,
      startX: startX,
      startY: startY,
      currentX: canvasX,
      currentY: canvasY
    });
  };

  const handlePortDrop = (targetNodeId: string) => {
    if (wireDragState && wireDragState.sourceId !== targetNodeId) {
      setNodes(prev => prev.map(n => {
        if (n.id === targetNodeId) {
          const edges = [...(n.incomingEdges || [])];
          if (!edges.some(e => e.sourceId === wireDragState.sourceId)) {
            edges.push({ sourceId: wireDragState.sourceId, type: 'default' });
          }
          return { ...n, incomingEdges: edges };
        }
        return n;
      }));
      
      // Trigger regeneration asynchronously with the new edge
      setTimeout(() => {
        const latestNode = nodesRef.current.find(n => n.id === targetNodeId);
        if (latestNode && latestNode.type !== 'source') {
          generateNode(
            latestNode.prompt,
            latestNode.x,
            latestNode.y,
            latestNode.incomingEdges,
            latestNode.id,
            false,
            latestNode.settings
          );
        }
      }, 0);
    }
    setWireDragState(null);
  };

  const handleCorrectionDrop = (targetNodeId: string) => {
    if (wireDragState && wireDragState.sourceId !== targetNodeId) {
      const sourceId = wireDragState.sourceId;
      setNodes(prev => {
        const nextNodes = [...prev];
        const targetNodeIndex = nextNodes.findIndex(n => n.id === targetNodeId);
        
        if (targetNodeIndex !== -1) {
          const targetNode = nextNodes[targetNodeIndex];
          const edges = [...(targetNode.incomingEdges || [])];
          if (!edges.some(e => e.sourceId === sourceId)) {
            edges.push({ sourceId: sourceId, type: 'correction' });
          } else {
            // Update existing to correction
            const edgeIndex = edges.findIndex(e => e.sourceId === sourceId);
            edges[edgeIndex] = { ...edges[edgeIndex], type: 'correction' };
          }
          
          nextNodes[targetNodeIndex] = { ...targetNode, incomingEdges: edges };
          
          // Trigger the correction generation asynchronously
          setTimeout(() => {
            const latestNode = nodesRef.current.find(n => n.id === targetNodeId);
            if (latestNode) {
              generateNode(
                latestNode.prompt, 
                latestNode.x, 
                latestNode.y, 
                latestNode.incomingEdges, 
                targetNodeId, 
                true // shouldRipple = true
              );
            }
          }, 50);
        }
        return nextNodes;
      });
    }
    setWireDragState(null);
  };

  const handleEdgeContextMenu = (e: React.MouseEvent, targetNodeId: string, sourceId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === targetNodeId) {
        const edges = [...(n.incomingEdges || [])];
        if (n.parentIds) {
          n.parentIds.forEach(pid => {
            if (!edges.some(e => e.sourceId === pid)) {
              edges.push({ sourceId: pid, type: 'default', bandwidth: 'immediate' });
            }
          });
        }
        const edgeIndex = edges.findIndex(e => e.sourceId === sourceId);
        if (edgeIndex !== -1) {
          const currentBandwidth = edges[edgeIndex].bandwidth || 'immediate';
          edges[edgeIndex] = {
            ...edges[edgeIndex],
            bandwidth: currentBandwidth === 'immediate' ? 'lineage' : 'immediate'
          };
        }
        return { ...n, incomingEdges: edges };
      }
      return n;
    }));
  };

  const handleEdgeClick = (targetNodeId: string, sourceId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === targetNodeId) {
        const edges = [...(n.incomingEdges || [])];
        if (n.parentIds) {
          n.parentIds.forEach(pid => {
            if (!edges.some(e => e.sourceId === pid)) {
              edges.push({ sourceId: pid, type: 'default' });
            }
          });
        }

        const edgeIndex = edges.findIndex(e => e.sourceId === sourceId);
        if (edgeIndex !== -1) {
          const currentType = edges[edgeIndex].type;
          let nextType: EdgeType = 'default';
          if (currentType === 'default') nextType = 'source_of_truth';
          else if (currentType === 'source_of_truth') nextType = 'style_reference';
          else if (currentType === 'style_reference') nextType = 'counter_argument';
          else nextType = 'default';
          
          edges[edgeIndex] = { ...edges[edgeIndex], type: nextType };
        }
        return { ...n, incomingEdges: edges, parentIds: undefined };
      }
      return n;
    }));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (wireDragState) {
      const canvasX = (e.clientX - transform.x) / transform.scale;
      const canvasY = (e.clientY - transform.y) / transform.scale;
      setWireDragState(prev => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
    } else if (isDragging) {
      const dx = e.clientX - dragStartInfo.current.x;
      const dy = e.clientY - dragStartInfo.current.y;
      setTransform(prev => ({
        ...prev,
        x: dragStartInfo.current.transformX + dx,
        y: dragStartInfo.current.transformY + dy,
      }));
    } else if (draggingNodeId) {
      const dx = (e.clientX - nodeDragStartInfo.current.x) / transform.scale;
      const dy = (e.clientY - nodeDragStartInfo.current.y) / transform.scale;
      setNodes(prev => prev.map(n => 
        n.id === draggingNodeId ? { ...n, x: nodeDragStartInfo.current.nodeX + dx, y: nodeDragStartInfo.current.nodeY + dy } : n
      ));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    
    if (draggingNodeId) {
      // Check for Crucible (Merge) Drop
      const draggedNode = nodes.find(n => n.id === draggingNodeId);
      if (draggedNode) {
        const centerX = draggedNode.x + draggedNode.width / 2;
        const centerY = draggedNode.y + 100; // rough visual center
        
        const targetNode = nodes.find(n => 
          n.id !== draggingNodeId &&
          centerX >= n.x &&
          centerX <= n.x + n.width &&
          centerY >= n.y &&
          centerY <= n.y + 400 // rough height bound
        );

        if (targetNode) {
          const mode = window.confirm("Crucible Merge Detected!\n\nOK: Synthesize these nodes\nCancel: Find Contradictions");
          const prompt = mode ? "Synthesize these nodes into a unified concept" : "Find contradictions and friction points between these nodes";
          
          const newX = targetNode.x + targetNode.width + 100;
          const newY = targetNode.y + 100;
          
          const incomingEdges: {sourceId: string, type: EdgeType}[] = [
            { sourceId: targetNode.id, type: 'default' },
            { sourceId: draggedNode.id, type: 'default' }
          ];
          generateNode(prompt, newX, newY, incomingEdges);
        }
      }
    }
    
    setDraggingNodeId(null);
    setWireDragState(null);
    if ((e.target as HTMLElement).hasPointerCapture && (e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Disable zooming for now, just pan
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.002;
      handleZoom(zoomFactor, e.clientX, e.clientY);
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleZoom = (delta: number, originX?: number, originY?: number) => {
    setTransform(prev => {
      const newScale = Math.min(Math.max(0.2, prev.scale + delta), 3);
      
      if (originX === undefined || originY === undefined) {
        // Zoom to center if no origin given
        originX = window.innerWidth / 2;
        originY = window.innerHeight / 2;
      }

      // Adjust x and y to keep the zoom centered on the pointer
      const scaleRatio = newScale / prev.scale;
      const newX = originX - (originX - prev.x) * scaleRatio;
      const newY = originY - (originY - prev.y) * scaleRatio;

      return { x: newX, y: newY, scale: newScale };
    });
  };

  const centerOnPosition = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale - (NODE_WIDTH / 2) * prev.scale,
      y: hh - y * prev.scale - 200 * prev.scale
    }));
  }, []);

  const handleCenterViewport = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale,
      y: hh - y * prev.scale
    }));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getHeaders = useCallback(() => {
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'x-provider-text': selectedTextModel,
      'x-provider-image': selectedImageModel
    };
    if (apiKeys.gemini) headers['x-api-key'] = apiKeys.gemini; // Legacy support
    if (apiKeys.gemini) headers['x-gemini-key'] = apiKeys.gemini;
    if (apiKeys.openai) headers['x-openai-key'] = apiKeys.openai;
    if (apiKeys.anthropic) headers['x-anthropic-key'] = apiKeys.anthropic;
    if (apiKeys.groq) headers['x-groq-key'] = apiKeys.groq;
    return headers;
  }, [apiKeys, selectedTextModel, selectedImageModel]);

  const processFile = async (file: File, dropX?: number, dropY?: number) => {
    let x = 0;
    let y = 0;
    
    if (dropX !== undefined && dropY !== undefined) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = dropX - rect.left;
        const clientY = dropY - rect.top;
        x = (clientX - transform.x) / transform.scale;
        y = (clientY - transform.y) / transform.scale;
      }
    } else {
      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      x = (hw - transform.x) / transform.scale;
      y = (hh - transform.y) / transform.scale;
    }
    
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const newNode: GridNodeData = {
      id, x, y,
      width: NODE_WIDTH,
      prompt: `Ingesting: ${file.name}`,
      status: 'generating',
      versionIndex: 0,
      versions: [],
      type: 'source'
    };
    
    setNodes(prev => [...prev, newNode]);
    setTimeout(() => centerOnPosition(x, y), 50);

    try {
      // 1. Upload the file to server
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadHeaders: HeadersInit = {};
      const key = localStorage.getItem('gemini-api-key');
      if (key) uploadHeaders['x-api-key'] = key;

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed. Server responded with status: " + uploadRes.status);
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);
      
      const localUrl = URL.createObjectURL(file);
      
      const fileDataObj = {
        mimeType: uploadData.mimeType,
        uri: uploadData.uri,
        name: file.name,
        localUrl,
        chunks: uploadData.chunks || []
      };

      // Index chunks into persistent Local Vector Store
      if (uploadData.chunks && uploadData.chunks.length > 0) {
        await vectorMemoryStore.addNodeChunks(id, uploadData.chunks);
      }

      const chunkCount = uploadData.chunks?.length || 0;
      const summaryPart = uploadData.summary ? `\n\n**Key Takeaways:**\n${uploadData.summary}` : '';
      const vectorPart = chunkCount > 0 
        ? `\n\n🧠 **Memory Vector Store:** ${chunkCount} semantic chunks indexed with 3,072-dim embeddings. Any question or reasoning node wired to this node (or asking about its topics) will automatically retrieve these vector chunks.`
        : '';

      setNodes(prev => prev.map(n => n.id === id ? {
        ...n,
        prompt: `Data Node: ${file.name}`,
        status: 'idle',
        versionIndex: 0,
        versions: [{ 
          text: `**Knowledge Block**\n\nFile attached: \`${file.name}\`\nType: \`${uploadData.mimeType}\`${summaryPart}${vectorPart}\n\n*Wire this node into an AI Node or prompt any question to leverage its semantic memory.*` 
        }],
        fileData: fileDataObj,
        chunks: uploadData.chunks || []
      } : n));
    } catch (err) {
      console.error(err);
      setNodes(prev => prev.map(node => 
        node.id === id ? { ...node, status: 'error' as const, versions: [{ text: 'Failed to ingest file.' }] } : node
      ));
    }
  };

  // --- End of processText / processFile ---

  const handleAutoCluster = async () => {
    if (nodes.length === 0) return;
    
    // Prepare data payload
    const clusterPayload = nodes.map(n => ({
      id: n.id,
      content: `${n.prompt} ${n.versions[n.versionIndex]?.text || ''}`
    }));

    try {
      const res = await fetch('/api/cluster', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nodes: clusterPayload })
      });
      if (!res.ok) throw new Error("Clustering failed.");
      const layoutData = await res.json();
      
      if (!layoutData.error) {
        setNodes(prev => prev.map(n => {
          if (layoutData[n.id]) {
            return { ...n, x: layoutData[n.id].x, y: layoutData[n.id].y };
          }
          return n;
        }));
        
        // Optionally center on the bounding box of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        Object.values(layoutData).forEach((pos: any) => {
          if (pos.x < minX) minX = pos.x;
          if (pos.y < minY) minY = pos.y;
          if (pos.x > maxX) maxX = pos.x;
          if (pos.y > maxY) maxY = pos.y;
        });
        
        if (minX !== Infinity) {
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          centerOnPosition(cx, cy);
        }
      }
    } catch (err) {
      console.error("Auto-cluster failed:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processText = (text: string, dropX?: number, dropY?: number) => {
    let x = 0;
    let y = 0;
    
    if (dropX !== undefined && dropY !== undefined) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = dropX - rect.left;
        const clientY = dropY - rect.top;
        x = (clientX - transform.x) / transform.scale;
        y = (clientY - transform.y) / transform.scale;
      }
    } else {
      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      x = (hw - transform.x) / transform.scale;
      y = (hh - transform.y) / transform.scale;
    }
    
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const newNode: GridNodeData = {
      id, x, y,
      width: NODE_WIDTH,
      prompt: `Pasted Text Data`,
      status: 'idle',
      versionIndex: 0,
      versions: [{ text: `**Knowledge Block**\n\n${text}` }],
      type: 'source'
    };
    
    setNodes(prev => [...prev, newNode]);
    setTimeout(() => centerOnPosition(x, y), 50);

    // Vectorize pasted text asynchronously in background
    fetch('/api/chunk-text', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text, sourceName: 'Pasted Text Data' }),
    }).then(res => res.json()).then(async data => {
      if (data.chunks && data.chunks.length > 0) {
        await vectorMemoryStore.addNodeChunks(id, data.chunks);
        setNodes(prev => prev.map(n => n.id === id ? {
          ...n,
          chunks: data.chunks
        } : n));
      }
    }).catch(err => {
      console.warn("Vectorization of pasted text had non-fatal issue:", err);
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file, e.clientX, e.clientY);
      return;
    }

    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      processText(text, e.clientX, e.clientY);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        processFile(e.clipboardData.files[0]);
      } else if (e.clipboardData?.types.includes('text/plain')) {
        const text = e.clipboardData.getData('text/plain');
        if (text) {
          processText(text);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    processFile(e.target.files[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateNode = async (
    prompt: string, 
    x: number, 
    y: number, 
    incomingEdges?: EdgeConnection[], 
    isRegenerationOf?: string, 
    shouldRipple?: boolean, 
    nodeSettings?: GridNodeData['settings'],
    role?: NodeRole,
    confidenceScore?: number
  ) => {
    const id = isRegenerationOf || `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const effectiveRole: NodeRole = role || (
      prompt.toLowerCase().includes('devil') || prompt.toLowerCase().includes('stress-test') ? 'stress_test' :
      prompt.toLowerCase().includes('decision') || prompt.toLowerCase().includes('verdict') ? 'decision' :
      prompt.toLowerCase().includes('evidence') || prompt.toLowerCase().includes('benchmark') ? 'evidence' :
      'hypothesis'
    );

    // Create new node or update existing to 'generating'
    if (isRegenerationOf) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'generating', role: role || n.role } : n));
    } else {
      const newNode: GridNodeData = {
        id, x, y,
        width: NODE_WIDTH,
        prompt,
        status: 'generating',
        versionIndex: 0,
        versions: [],
        incomingEdges,
        settings: nodeSettings,
        role: effectiveRole,
        confidenceScore
      };
      setNodes(prev => [...prev, newNode]);
    }
    
    // Center view locally
    setTimeout(() => centerOnPosition(x, y), 50);

    const generateStartMs = Date.now();
    try {
      // Gather context from parents if it exists
      let contextData = undefined;
      const currentSettings = nodeSettings || (isRegenerationOf ? nodes.find(n => n.id === isRegenerationOf)?.settings : undefined);
      const edgesToUse = incomingEdges || (isRegenerationOf ? nodes.find(n => n.id === id)?.incomingEdges : []);
      
      const buildLineageText = (nodeId: string, currentNodes: GridNodeData[], visited = new Set<string>()): string => {
        if (visited.has(nodeId)) return '';
        visited.add(nodeId);
        
        const node = currentNodes.find(n => n.id === nodeId);
        if (!node) return '';
        
        const version = node.versions[node.versionIndex] || node;
        let text = `[Ancestral Node: ${node.prompt} (ID: ${node.id})]:\n${version.text}\n\n`;
        
        if (node.memorySnapshot) {
           text += `[Compressed Historical Memory]:\n${node.memorySnapshot}\n\n`;
        } else if (node.incomingEdges && node.incomingEdges.length > 0) {
           node.incomingEdges.forEach(edge => {
             text += buildLineageText(edge.sourceId, currentNodes, visited);
           });
        }
        return text;
      };

      let visitedAncestors = new Set<string>();
      let finalCombinedText = '';

      if (edgesToUse && edgesToUse.length > 0) {
        let combinedText = '';
        let fileDataArray: any[] = [];
        
        edgesToUse.forEach(edge => {
          const parentNode = nodes.find(n => n.id === edge.sourceId);
          if (parentNode) {
            visitedAncestors.add(parentNode.id);
            const pVersion = parentNode.versions[parentNode.versionIndex];
            if (pVersion) {
               let relationLabel = "Context";
               if (edge.type === 'source_of_truth') relationLabel = "Strict Ground Truth Evidence";
               else if (edge.type === 'style_reference') relationLabel = "Stylistic Reference";
               else if (edge.type === 'counter_argument') relationLabel = "Adversarial Challenge & Devil's Advocate Risk";
               else if (edge.type === 'correction') relationLabel = "CRITICAL FACTUAL CORRECTION (Must revise assumptions based on this)";
               
               if (edge.bandwidth === 'lineage') {
                 relationLabel += " (AND ENTIRE ANCESTRAL LINEAGE)";
                 combinedText += `[${relationLabel} starting from Node: ${parentNode.prompt} (ID: ${parentNode.id})]:\n${pVersion.text}\n\n---\n\n`;
                 if (parentNode.memorySnapshot) {
                   combinedText += `[Compressed Historical Memory]:\n${parentNode.memorySnapshot}\n\n`;
                 } else if (parentNode.incomingEdges) {
                   parentNode.incomingEdges.forEach(parentEdge => {
                     combinedText += buildLineageText(parentEdge.sourceId, nodes, visitedAncestors);
                   });
                 }
               } else {
                 combinedText += `[${relationLabel} from Node: ${parentNode.prompt} (ID: ${parentNode.id})]:\n${pVersion.text}\n\n---\n\n`;
               }
            }
            if (parentNode.fileData) {
              fileDataArray.push(parentNode.fileData);
            }
          }
        });
        
        if (currentSettings?.isolateContext) {
          combinedText = "";
        }
        
        finalCombinedText = combinedText;
        if (combinedText || fileDataArray.length > 0) {
          contextData = {
            text: combinedText,
            fileData: fileDataArray.length > 0 ? fileDataArray : undefined
          };
        }
      }

      // AMBIENT GRAVITY
      const GRAVITY_RADIUS = 800;
      const ambientNodes = nodes
        .filter(n => n.id !== id && !visitedAncestors.has(n.id))
        .map(n => ({ node: n, dist: Math.hypot(n.x - x, n.y - y) }))
        .filter(item => item.dist < GRAVITY_RADIUS && item.node.versions[item.node.versionIndex]?.text)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);

      if (ambientNodes.length > 0) {
        if (!contextData) contextData = {};
        let ambientText = `\n\n[AMBIENT SPATIAL CONTEXT - Knowledge physically near this node]:\n`;
        ambientNodes.forEach(item => {
          const pVersion = item.node.versions[item.node.versionIndex];
          ambientText += `[Nearby Node: ${item.node.prompt} (ID: ${item.node.id}, Distance: ${Math.round(item.dist)}px)]:\n${pVersion.text}\n\n`;
          
          if (item.node.fileData) {
            if (!contextData.fileData) contextData.fileData = [];
            if (!Array.isArray(contextData.fileData)) contextData.fileData = [contextData.fileData];
            contextData.fileData.push(item.node.fileData);
          }
        });
        
        contextData.text = (contextData.text || '') + ambientText;
        finalCombinedText = contextData.text;
      }

      // SEMANTIC MEMORY RETRIEVAL
      let retrievedMemoryChunks: any[] = [];
      try {
        const explicitSourceIds = edgesToUse && edgesToUse.length > 0 ? edgesToUse.map(e => e.sourceId) : undefined;
        const matched = await retrieveRelevantChunks(prompt, {
          topK: 4,
          minScore: 0.35,
          filterNodeIds: explicitSourceIds,
          apiKey: apiKeys.gemini || undefined
        });

        if (matched && matched.length > 0) {
          retrievedMemoryChunks = matched.map(m => ({
            id: m.chunk.id,
            nodeId: m.chunk.nodeId,
            sourceName: m.chunk.sourceName,
            heading: m.chunk.heading,
            text: m.chunk.text,
            score: Math.round(m.score * 100) / 100
          }));

          let memoryContextText = `\n\n[RELEVANT LONG-TERM MEMORY (Vector Cosine Retrieval)]:\n`;
          matched.forEach(m => {
            memoryContextText += `[Memory Chunk from "${m.chunk.sourceName}" - ${m.chunk.heading || 'Section'} (Similarity: ${Math.round(m.score * 100)}%)]:\n${m.chunk.text}\n\n`;
          });

          if (!contextData) contextData = {};
          contextData.text = (contextData.text || '') + memoryContextText;
          finalCombinedText = contextData.text;
        }
      } catch (vectorErr) {
        console.warn("Vector memory retrieval had non-fatal error:", vectorErr);
      }

      // Fetch structured text
      const startMs = Date.now();
      const reqBody = { 
        prompt, 
        context: contextData, 
        customModel: currentSettings?.customModel, 
        customPersona: currentSettings?.persona, 
        capability: currentSettings?.capability,
        role: effectiveRole
      };
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) throw new Error("Generation failed. Server responded with status: " + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const endMs = Date.now();

      // Extract confidence score if decision node
      let computedConfidence = confidenceScore;
      if (effectiveRole === 'decision' && !computedConfidence) {
        const confMatch = (data.text || '').match(/confidence[:\s]*(\d+)%/i);
        computedConfidence = confMatch ? Math.min(100, Math.max(50, parseInt(confMatch[1]))) : 88;
      }

      let insertIndex = 0;

      setNodes(prev => prev.map(node => {
        if (node.id === id) {
          insertIndex = isRegenerationOf ? node.versions.length : 0;
          const newVersion = {
            prompt,
            asciiArt: '',
            imageUrl: '',
            imageLoading: false,
            text: data.text || 'No text',
            prompts: data.prompts || [],
            executionLog: {
              modelUsed: getHeaders()['x-provider-text']?.split('|')[1] || 'default',
              requestPayload: reqBody,
              responsePayload: data,
              latencyMs: endMs - startMs,
              timestamp: startMs,
              retrievedChunks: retrievedMemoryChunks.length > 0 ? retrievedMemoryChunks : undefined
            }
          };
          
          return {
            ...node,
            status: 'ready',
            role: effectiveRole,
            confidenceScore: computedConfidence,
            versions: isRegenerationOf ? [...node.versions, newVersion] : [newVersion],
            versionIndex: insertIndex,
            text: newVersion.text,
            prompts: newVersion.prompts,
            executionLog: newVersion.executionLog
          };
        }
        return node;
      }));

      // Background Compressor Agent
      if (finalCombinedText && (finalCombinedText.length > 3000 || visitedAncestors.size >= 4)) {
        setTimeout(async () => {
          try {
            const compRes = await fetch('/api/compress', {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ text: finalCombinedText, customModel: currentSettings?.customModel })
            });
            if (!compRes.ok) return;
            const compData = await compRes.json();
            if (compData.summary) {
              setNodes(prev => prev.map(n => n.id === id ? { ...n, memorySnapshot: compData.summary } : n));
            }
          } catch (e) {
            console.error("Compression agent failed", e);
          }
        }, 100);
      }

      // Trigger recursive ripple if this is a correction/ripple
      if (shouldRipple) {
        setTimeout(() => {
          const latestNodes = nodesRef.current;
          const childNodes = latestNodes.filter(n => n.incomingEdges?.some(e => e.sourceId === id));
          
          childNodes.forEach(child => {
            generateNode(
              child.prompt, 
              child.x, 
              child.y, 
              child.incomingEdges, 
              child.id, 
              true,
              child.settings,
              child.role
            );
          });
        }, 100);
      }

    } catch (error: any) {
      console.error(error);
      const endMs = Date.now();
      setNodes(prev => prev.map(node => node.id === id ? { 
        ...node, 
        status: 'error',
        executionLog: {
          modelUsed: getHeaders()['x-provider-text']?.split('|')[1] || 'default',
          error: error?.message || String(error),
          latencyMs: endMs - generateStartMs,
          timestamp: generateStartMs
        }
      } : node));
    }
  };

  // --- EPISTEMIC OPERATOR HANDLERS (THE RACE-WINNING ADVANTAGE) ---
  const handleStressTest = (nodeId: string) => {
    const source = nodes.find(n => n.id === nodeId);
    if (!source) return;
    const spawnX = source.x + source.width + 120;
    const spawnY = source.y + 40;
    const prompt = `Devil's Advocate Stress-Test: Critically attack assumptions, fatal edge cases, and hidden failure modes in: "${source.prompt}"`;
    generateNode(
      prompt,
      spawnX,
      spawnY,
      [{ sourceId: nodeId, type: 'counter_argument', label: 'Adversarial Challenge' }],
      undefined,
      false,
      undefined,
      'stress_test'
    );
  };

  const handleSynthesizeBranch = (nodeId: string) => {
    const source = nodes.find(n => n.id === nodeId);
    if (!source) return;
    const incomingSources = source.incomingEdges?.map(e => e.sourceId) || [];
    const targetIds = Array.from(new Set([nodeId, ...incomingSources]));
    const spawnX = source.x + source.width + 140;
    const spawnY = source.y + 160;
    const edges: EdgeConnection[] = targetIds.map(tid => ({
      sourceId: tid,
      type: 'source_of_truth',
      label: 'Decision Basis'
    }));
    const prompt = `Synthesize Audit-Proof Decision Verdict resolving the core hypotheses, empirical evidence, and stress-tests in: "${source.prompt}"`;
    generateNode(
      prompt,
      spawnX,
      spawnY,
      edges,
      undefined,
      false,
      undefined,
      'decision',
      88
    );
  };

  const handleFindEvidence = (nodeId: string) => {
    const source = nodes.find(n => n.id === nodeId);
    if (!source) return;
    const spawnX = source.x + source.width + 120;
    const spawnY = source.y - 140;
    const prompt = `Extract and verify Ground Truth empirical metrics, benchmark data, and citations regarding: "${source.prompt}"`;
    generateNode(
      prompt,
      spawnX,
      spawnY,
      [{ sourceId: nodeId, type: 'source_of_truth', label: 'Evidence Grounding' }],
      undefined,
      false,
      undefined,
      'evidence'
    );
  };

  const handleAlternateHypothesis = (nodeId: string) => {
    const source = nodes.find(n => n.id === nodeId);
    if (!source) return;
    const spawnX = source.x;
    const spawnY = source.y + 360;
    const prompt = `Formulate an Orthogonal Alternate Hypothesis / Strategy to: "${source.prompt}"`;
    generateNode(
      prompt,
      spawnX,
      spawnY,
      [{ sourceId: nodeId, type: 'default', label: 'Alternate Vector' }],
      undefined,
      false,
      undefined,
      'hypothesis'
    );
  };

  const handleChangeRole = (nodeId: string, role: NodeRole) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, role } : n));
  };

  // Instant Starter Canvases for the target user
  const handleLoadTemplate = (templateKey: 'pricing' | 'slm' | 'architecture') => {
    if (templateKey === 'pricing') {
      const node1: GridNodeData = {
        id: 'node-tpl-pricing-1',
        x: 80,
        y: 160,
        width: NODE_WIDTH,
        prompt: "Proposal: Transition enterprise pricing from Per-Seat licenses to Hybrid Base Floor + Usage-Based AI Tokens.",
        role: 'hypothesis',
        status: 'ready',
        versionIndex: 0,
        versions: [{
          prompt: "Proposal: Transition enterprise pricing from Per-Seat licenses to Hybrid Base Floor + Usage-Based AI Tokens.",
          text: `### Strategic Premise: Hybrid Consumption Pricing
We propose moving our core enterprise contracts away from pure seat-based licensing ($80/seat/month) to a **Hybrid Base + Consumption Model**:
1. **Platform Access Floor**: $1,500/month flat fee covering workspace admin, SSO, and baseline workflows.
2. **AI Action Tokens**: $0.004 per multi-step workflow execution, billed in prepaid drawdown tranches.

**Core Thesis**: Seat expansion has plateaued as AI automates analyst headcount. Monolithic seat pricing actively punishes customer efficiency. Consumption pricing aligns revenue directly with automated workload volume [Benchmark Cohort](#node-tpl-pricing-3).`,
          prompts: [
            "Stress-test against enterprise budget predictability",
            "Compare with Snowflake and Datadog NRR trends",
            "Synthesize procurement contract migration plan"
          ]
        }]
      };

      const node2: GridNodeData = {
        id: 'node-tpl-pricing-2',
        x: 580,
        y: 80,
        width: NODE_WIDTH,
        prompt: "Devil's Advocate Stress-Test: Enterprise procurement rejection of variable billing and sales commission friction.",
        role: 'stress_test',
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [{ sourceId: 'node-tpl-pricing-1', type: 'counter_argument', label: 'Procurement Vulnerability' }],
        versions: [{
          prompt: "Devil's Advocate Stress-Test: Enterprise procurement rejection of variable billing and sales commission friction.",
          text: `### Critical Vulnerabilities & Blindspots:
1. **Procurement Budget Hard-Caps**: Fortune 500 procurement teams and CFOs require deterministic annual budget ceilings. Uncapped overage clauses delay enterprise sales cycles by an average of 4.2 months.
2. **Sales Compensation Mismatch**: Account executives struggle to forecast commissions on variable usage, leading to internal resistance and quota gaming.
3. **Bill-Shock Churn**: In month 3, spike workloads (e.g. quarterly audit runs) produce unexpected overage bills, provoking customer escalations and executive scrutiny.`,
          prompts: [
            "Evaluate prepaid rollover commitments to resolve unpredictability",
            "Design capped annual contract thresholds"
          ]
        }]
      };

      const node3: GridNodeData = {
        id: 'node-tpl-pricing-3',
        x: 80,
        y: 620,
        width: NODE_WIDTH,
        prompt: "Ground Truth Evidence: Bessemer & OpenView 2024 AI SaaS Pricing Cohort Benchmarks.",
        role: 'evidence',
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [{ sourceId: 'node-tpl-pricing-1', type: 'source_of_truth', label: 'Empirical Data' }],
        versions: [{
          prompt: "Ground Truth Evidence: Bessemer & OpenView 2024 AI SaaS Pricing Cohort Benchmarks.",
          text: `### Empirical Benchmark Findings:
- **Net Retention Rate (NRR)**: Companies with Hybrid Base + Usage models averaged **124% NRR**, versus **106% NRR** for pure seat-based models.
- **Contract Structure**: 78% of enterprise consumption contracts use **Prepaid Annual Minimum Commitments with 12-month rollover**, eliminating month-to-month variable billing surprises for finance.
- **Sales Quota Alignment**: Commissions paid on upfront commit + 50% split on realized net overage after quarter close.`,
          prompts: [
            "Structure standard contract amendment clause",
            "Calculate gross margin impact of token pricing"
          ]
        }]
      };

      const node4: GridNodeData = {
        id: 'node-tpl-pricing-4',
        x: 1080,
        y: 280,
        width: NODE_WIDTH,
        prompt: "Synthesized Decision Verdict: Adopt Annual Drawdown Commitments with 20% Buffer Caps.",
        role: 'decision',
        confidenceScore: 88,
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [
          { sourceId: 'node-tpl-pricing-1', type: 'source_of_truth', label: 'Core Proposal' },
          { sourceId: 'node-tpl-pricing-2', type: 'source_of_truth', label: 'Addressed Risks' },
          { sourceId: 'node-tpl-pricing-3', type: 'source_of_truth', label: 'Benchmark Evidence' }
        ],
        versions: [{
          prompt: "Synthesized Decision Verdict: Adopt Annual Drawdown Commitments with 20% Buffer Caps.",
          text: `### Executive Decision Verdict (Confidence: 88%)
**RECOMMENDATION**: Transition new customer deals to **Prepaid Annual Commitment Drawdown** with automated alert buffers.

#### 1. Resolution of Devil's Advocate Risks:
- **Budget Predictability Resolved**: Contract specifies fixed annual minimum ($24k/year) with 100% token rollover into month 12. CFO signs an immutable annual PO [Procurement](#node-tpl-pricing-2).
- **Bill-Shock Guardrails**: Automated notification at 75% and 90% consumption with client toggle to pause or auto-approve $5k tranche top-up.

#### 2. Immediate 30-Day Execution:
- Retain existing seat pricing for grandfathered renewal cohorts for 12 months.
- Launch pilot hybrid contract on next 5 enterprise pilots with target 120%+ expansion goal [Benchmarks](#node-tpl-pricing-3).`,
          prompts: [
            "Generate Executive Decision Brief",
            "Draft CFO one-pager"
          ]
        }]
      };

      setNodes([node1, node2, node3, node4]);
      setTransform({ x: -40, y: -40, scale: 0.72 });
    } else if (templateKey === 'slm') {
      const n1: GridNodeData = {
        id: 'node-tpl-slm-1',
        x: 80,
        y: 160,
        width: NODE_WIDTH,
        prompt: "Hypothesis: Replace Frontier API calls with Self-Hosted Fine-Tuned 8B Models for Document Ingestion.",
        role: 'hypothesis',
        status: 'ready',
        versionIndex: 0,
        versions: [{
          prompt: "Hypothesis: Replace Frontier API calls with Self-Hosted Fine-Tuned 8B Models for Document Ingestion.",
          text: `### Proposed Architecture:
Migrate high-frequency document extraction and classification from remote Frontier APIs to fine-tuned **Llama-3-8B / Qwen-2.5-7B** running on dedicated H100/A10G instances.

**Hypothesized Advantages**:
- 85% reduction in ongoing token inference cost.
- Sub-50ms latency for real-time text parsing.
- Zero data egress to third-party model providers [HIPAA/SOC2 compliance].`,
          prompts: ["Stress-test edge-case generalization", "Calculate break-even GPU utilization"]
        }]
      };
      const n2: GridNodeData = {
        id: 'node-tpl-slm-2',
        x: 580,
        y: 80,
        width: NODE_WIDTH,
        prompt: "Devil's Advocate: Rare taxonomy hallucinations and cold-start infrastructure maintenance overhead.",
        role: 'stress_test',
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [{ sourceId: 'node-tpl-slm-1', type: 'counter_argument', label: 'Failure Modes' }],
        versions: [{
          prompt: "Devil's Advocate: Rare taxonomy hallucinations and cold-start infrastructure maintenance overhead.",
          text: `### Critical Vulnerabilities:
1. **Long-Tail Out-of-Distribution Failures**: 8B models exhibit high error rates when documents contain non-standard layouts, handwritten notes, or multilingual anomalies.
2. **Infrastructure TCO**: Dedicated GPU reservations cost ~$1,800/month per H100 node regardless of idle time, negating savings below 10M tokens/day.
3. **Engineering Opportunity Cost**: Managing vLLM clusters distracts engineering from customer product features.`,
          prompts: ["Design hybrid fallback gateway", "Audit break-even traffic thresholds"]
        }]
      };
      const n3: GridNodeData = {
        id: 'node-tpl-slm-3',
        x: 1080,
        y: 240,
        width: NODE_WIDTH,
        prompt: "Synthesized Decision Verdict: Tiered Routing Gateway (SLM Fast-Path + Frontier Fallback).",
        role: 'decision',
        confidenceScore: 92,
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [
          { sourceId: 'node-tpl-slm-1', type: 'source_of_truth' },
          { sourceId: 'node-tpl-slm-2', type: 'source_of_truth' }
        ],
        versions: [{
          prompt: "Synthesized Decision Verdict: Tiered Routing Gateway (SLM Fast-Path + Frontier Fallback).",
          text: `### Executive Decision Verdict (Confidence: 92%)
**RECOMMENDATION**: Implement a **Confidence-Gated Router**:
1. Route 90% of predictable structured extraction to serverless 8B endpoints.
2. Compute model perplexity/confidence score; if confidence < 0.85, transparently escalate request to Frontier API.

**Result**: 75% net cost reduction without risking accuracy degradation on complex edge cases.`,
          prompts: ["Generate Decision Brief", "Create benchmark test suite"]
        }]
      };
      setNodes([n1, n2, n3]);
      setTransform({ x: -40, y: -40, scale: 0.75 });
    } else {
      const a1: GridNodeData = {
        id: 'node-tpl-arch-1',
        x: 80,
        y: 160,
        width: NODE_WIDTH,
        prompt: "Proposal: Re-architect 14 microservices into a unified modular monolith with strict domain boundaries.",
        role: 'hypothesis',
        status: 'ready',
        versionIndex: 0,
        versions: [{
          prompt: "Proposal: Re-architect 14 microservices into a unified modular monolith with strict domain boundaries.",
          text: `### Core Thesis:
Our current 14 microservices create unacceptable developer overhead: distributed tracing complexity, flaky end-to-end testing, and cross-service latency penalties (280ms average p99 overhead).
Consolidation into a **Modular Monolith** using strict Go packages and unified database transactions will accelerate shipping velocity 3x.`,
          prompts: ["Audit deployment decoupling", "Compare database lock contention"]
        }]
      };
      const a2: GridNodeData = {
        id: 'node-tpl-arch-2',
        x: 580,
        y: 80,
        width: NODE_WIDTH,
        prompt: "Devil's Advocate: Shared database saturation and simultaneous deployment blockers.",
        role: 'stress_test',
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [{ sourceId: 'node-tpl-arch-1', type: 'counter_argument', label: 'Decoupling Risks' }],
        versions: [{
          prompt: "Devil's Advocate: Shared database saturation and simultaneous deployment blockers.",
          text: `### Failure Modes:
1. **Single Point of Failure**: A bad migration or memory leak in the reporting module brings down the primary checkout engine.
2. **Release Train Contention**: 5 engineering teams blocked waiting for a single master CI pipeline to clear.
3. **Database Connection Pool Exhaustion**: Shared connection pools hit saturation under spike load.`,
          prompts: ["Isolate reporting schema", "Enforce read replicas"]
        }]
      };
      const a3: GridNodeData = {
        id: 'node-tpl-arch-3',
        x: 1080,
        y: 240,
        width: NODE_WIDTH,
        prompt: "Synthesized Decision Verdict: Core Monolith with Read Replicas and Isolated Critical Checkout Worker.",
        role: 'decision',
        confidenceScore: 85,
        status: 'ready',
        versionIndex: 0,
        incomingEdges: [
          { sourceId: 'node-tpl-arch-1', type: 'source_of_truth' },
          { sourceId: 'node-tpl-arch-2', type: 'source_of_truth' }
        ],
        versions: [{
          prompt: "Synthesized Decision Verdict: Core Monolith with Read Replicas and Isolated Critical Checkout Worker.",
          text: `### Executive Decision Verdict (Confidence: 85%)
**RECOMMENDATION**: Merge 12 supporting microservices into the core modular monolith, while keeping the high-availability Checkout Worker isolated.

**Mitigations**:
- Enforce private Postgres schemas per domain package.
- Offload all analytical queries to dedicated read replicas to guarantee checkout latency SLA.`,
          prompts: ["Generate Decision Brief", "Plan phase 1 migration"]
        }]
      };
      setNodes([a1, a2, a3]);
      setTransform({ x: -40, y: -40, scale: 0.75 });
    }
  };

  const getDecisionBriefMarkdown = () => {
    const decisions = nodes.filter(n => n.role === 'decision');
    const hypotheses = nodes.filter(n => n.role === 'hypothesis');
    const stressTests = nodes.filter(n => n.role === 'stress_test');
    const evidence = nodes.filter(n => n.role === 'evidence');

    let memo = `# EXECUTIVE DECISION BRIEF\n`;
    memo += `*Generated on ${new Date().toLocaleDateString()} | Non-Linear Argument Graph Synthesis*\n\n`;
    
    memo += `## Epistemic Audit Breakdown\n`;
    memo += `- **Total Reasoning Nodes**: ${nodes.length}\n`;
    memo += `- **Core Hypotheses Explored**: ${hypotheses.length}\n`;
    memo += `- **Adversarial Stress-Tests / Devil's Advocates**: ${stressTests.length}\n`;
    memo += `- **Ground Truth Evidence Citations**: ${evidence.length}\n`;
    memo += `- **Synthesized Verdicts**: ${decisions.length}\n\n`;

    memo += `---\n\n`;

    memo += `## 1. Executive Verdicts & Strategic Recommendations\n\n`;
    if (decisions.length === 0) {
      memo += `*No formal decision node synthesized yet. Click [Decide] on any reasoning branch to generate an audit-proof verdict.*\n\n`;
    } else {
      decisions.forEach((d, i) => {
        const v = d.versions[d.versionIndex] || d;
        memo += `### Verdict ${i + 1}: ${d.prompt}\n`;
        if (d.confidenceScore) memo += `**Confidence Rating**: ${d.confidenceScore}%\n\n`;
        memo += `${v.text}\n\n`;
      });
    }

    memo += `## 2. Adversarial Stress-Tests & Addressed Vulnerabilities\n\n`;
    if (stressTests.length === 0) {
      memo += `*No adversarial stress-tests recorded. Click [Stress-Test] on any hypothesis to explore failure modes.*\n\n`;
    } else {
      stressTests.forEach((st, i) => {
        const v = st.versions[st.versionIndex] || st;
        memo += `### Challenge ${i + 1}: ${st.prompt}\n`;
        memo += `${v.text}\n\n`;
      });
    }

    memo += `## 3. Core Strategic Hypotheses Explored\n\n`;
    hypotheses.forEach((h, i) => {
      const v = h.versions[h.versionIndex] || h;
      memo += `### Hypothesis ${i + 1}: ${h.prompt}\n`;
      memo += `${v.text}\n\n`;
    });

    if (evidence.length > 0) {
      memo += `## 4. Ground Truth Evidence & Citations\n\n`;
      evidence.forEach((e, i) => {
        const v = e.versions[e.versionIndex] || e;
        memo += `### Source Evidence ${i + 1}: ${e.prompt}\n`;
        memo += `${v.text}\n\n`;
      });
    }

    return memo;
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const startX = 0;
    const startY = 0;
    const executeSearch = () => {
      generateNode(searchQuery, startX, startY);
      setSearchQuery('');
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeSearch();
        }
        return;
      } else {
        setPendingAction(() => executeSearch);
        setShowBillingModal(true);
        return;
      }
    }

    executeSearch();
  };

  const handleMagicWand = async () => {
    const ideas = ["Evolution of Video Games", "Quantum Entanglement", "Rise of the Roman Empire", "History of Artificial Intelligence", "Deep Sea Ecosystems"];
    const text = ideas[Math.floor(Math.random() * ideas.length)];
    
    const executeMagicWand = () => {
      generateNode(text, 0, 0);
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeMagicWand();
        }
        return;
      } else {
        setPendingAction(() => executeMagicWand);
        setShowBillingModal(true);
        return;
      }
    }

    executeMagicWand();
  };

  const handleExpand = (prompt: string, parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    // Spawn to the right
    const newX = parent.x + parent.width + 400; // 400px gap for prompts and connections
    
    // Add initial offset so the line is never perfectly straight
    const initialOffset = Math.random() > 0.5 ? 200 : -200;
    let newY = parent.y + initialOffset;
    const estimatedHeight = 850; // Average node height to avoid overlap
    
    let isOccupied = true;
    let offsetMultiplier = 1;
    let direction = Math.random() > 0.5 ? 1 : -1; // 1 for down, -1 for up
    
    while (isOccupied) {
      isOccupied = nodes.some(n => 
        Math.abs(n.x - newX) < 200 && // Roughly in the same column
        Math.abs(n.y - newY) < estimatedHeight // Overlaps vertically
      );
      
      if (isOccupied) {
        newY = parent.y + initialOffset + (estimatedHeight * offsetMultiplier * direction);
        direction *= -1;
        if (direction === 1) {
          offsetMultiplier++;
        }
      }
    }
    
    const incomingEdges = [{ sourceId: parentId, type: 'default' as EdgeType }];
    generateNode(prompt, newX, newY, incomingEdges);
  };

  const handleRegenerate = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      let incomingEdges = node.incomingEdges;
      if (!incomingEdges && node.parentIds) {
        incomingEdges = node.parentIds.map(p => ({ sourceId: p, type: 'default' as EdgeType }));
      }
      generateNode(node.prompt, node.x, node.y, incomingEdges, nodeId);
    }
  };

  const handleDelete = (nodeId: string) => {
    // Delete this node and all descendants
    const getDescendants = (id: string, allNodes: GridNodeData[]): string[] => {
      const children = allNodes.filter(n => n.parentIds?.includes(id)).map(n => n.id);
      let desc = [...children];
      for (const childId of children) {
        desc = [...desc, ...getDescendants(childId, allNodes)];
      }
      return desc;
    };
    
    const toDelete = [nodeId, ...getDescendants(nodeId, nodes)];
    toDelete.forEach(id => {
      vectorMemoryStore.removeNodeChunks(id).catch(err => console.warn("Failed to remove node chunks from vector store", err));
    });
    setNodes(prev => prev.filter(n => !toDelete.includes(n.id)));
  };

  const setVersion = (nodeId: string, versionIndex: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, versionIndex } : n));
  };
  
  const handleUpdateText = (nodeId: string, newText: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        // Push a new version
        const currentVersion = n.versions[n.versionIndex];
        const newVersions = [...n.versions, { ...currentVersion, text: newText }];
        return {
          ...n,
          versions: newVersions,
          versionIndex: newVersions.length - 1
        };
      }
      return n;
    }));
  };

  const handleUpdateSettings = (nodeId: string, settings: any) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, settings } : n));
  };

  const handleFracture = (text: string, parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    // Spawn fracture slightly below the parent
    const newX = parent.x + 100;
    const newY = parent.y + parent.width + 100; // Roughly below

    const newNode: GridNodeData = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x: newX,
      y: newY,
      width: 500,
      prompt: 'Fractured Node',
      status: 'idle',
      versionIndex: 0,
      versions: [{ text }],
      incomingEdges: [{ sourceId: parentId, type: 'default' }]
    };

    setNodes(prev => [...prev, newNode]);
  };

  const handleAutoMap = async (nodeId: string, mapLevel: string = 'balanced') => {
    const parentNode = nodes.find(n => n.id === nodeId);
    if (!parentNode || !parentNode.fileData) return;

    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'generating' } : n));
    
    const startMs = Date.now();
    const reqBody = {
      text: parentNode.versions[0]?.text,
      uri: parentNode.fileData.uri,
      mimeType: parentNode.fileData.mimeType,
      mapLevel
    };

    try {
      const response = await fetch("/api/graphrag-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKeys.gemini || "",
          "x-provider-text": selectedTextModel,
        },
        body: JSON.stringify(reqBody)
      });

      if (!response.ok) throw new Error("Failed to auto-map");
      const data = await response.json();
      const endMs = Date.now();

      const newNodes: GridNodeData[] = [];
      const entityIdMap = new Map<string, string>(); // Maps raw entity ID to new Node ID

      // Create a node for each entity
      const radius = 600;
      data.entities?.forEach((entity: any, i: number) => {
        const angle = (i / (data.entities.length || 1)) * Math.PI * 2;
        const newX = parentNode.x + Math.cos(angle) * radius;
        const newY = parentNode.y + Math.sin(angle) * radius;
        const newId = `node-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        entityIdMap.set(entity.id, newId);
        newNodes.push({
          id: newId,
          x: newX,
          y: newY,
          width: 320,
          prompt: entity.label,
          status: 'idle',
          versionIndex: 0,
          type: 'default',
          versions: [{ 
            text: `**${entity.type.toUpperCase()}**\n\n${entity.description}` 
          }],
          incomingEdges: [{ sourceId: parentNode.id, type: 'source_of_truth', label: 'Extracted From' }],
          executionLog: {
            modelUsed: selectedTextModel.split('|')[1],
            requestPayload: reqBody,
            responsePayload: { entityExtracted: entity },
            latencyMs: endMs - startMs,
            timestamp: startMs
          }
        });
      });

      // Map relationships to incoming edges
      data.relationships?.forEach((rel: any) => {
        const sourceNodeId = entityIdMap.get(rel.source);
        const targetNodeId = entityIdMap.get(rel.target);

        if (sourceNodeId && targetNodeId) {
          const targetNode = newNodes.find(n => n.id === targetNodeId);
          if (targetNode) {
            targetNode.incomingEdges = targetNode.incomingEdges || [];
            targetNode.incomingEdges.push({
              sourceId: sourceNodeId,
              type: 'default',
              label: rel.label
            });
          }
        }
      });

      setNodes(prev => [...prev.map(n => n.id === nodeId ? { ...n, status: 'ready' as const } : n), ...newNodes]);
    } catch (err: any) {
      console.error(err);
      const endMs = Date.now();
      setNodes(prev => prev.map(n => n.id === nodeId ? { 
        ...n, 
        status: 'error' as const,
        executionLog: {
          modelUsed: selectedTextModel.split('|')[1],
          requestPayload: reqBody,
          error: err?.message || String(err),
          latencyMs: endMs - startMs,
          timestamp: startMs
        }
      } : n));
    }
  };

  const handleVisualize = async (nodeId: string) => {
    const parentNode = nodes.find(n => n.id === nodeId);
    if (!parentNode) return;
    
    const parentVersion = parentNode.versions[parentNode.versionIndex];
    if (!parentVersion) return;

    const newNodeId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newX = parentNode.x + parentNode.width + 100;
    const newY = parentNode.y;

    setNodes(prev => [...prev, {
      id: newNodeId,
      x: newX,
      y: newY,
      width: NODE_WIDTH,
      prompt: 'Visualize Lens',
      status: 'generating',
      versionIndex: 0,
      versions: [{ text: 'Synthesizing visual representation...' }],
      incomingEdges: [{ sourceId: nodeId, type: 'style_reference' }],
      type: 'lens'
    }]);

    const startMs = Date.now();
    const reqBody = { prompt: parentVersion.text };

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(reqBody)
      });
      
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Image generation failed"); }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const endMs = Date.now();

      setNodes(prev => prev.map(n => {
        if (n.id !== newNodeId) return n;
        const execLog = {
          modelUsed: getHeaders()['x-provider-image']?.split('|')[1] || 'imagen-3.0',
          requestPayload: reqBody,
          responsePayload: data,
          latencyMs: endMs - startMs,
          timestamp: startMs
        };
        return {
          ...n,
          status: 'idle',
          versions: [{ 
            text: 'Visual Synthesis Complete.',
            imageUrl: data.imageUrl,
            executionLog: execLog
          }],
          executionLog: execLog
        };
      }));
    } catch (err: any) {
      console.error(err);
      const endMs = Date.now();
      setNodes(prev => prev.map(n => {
        if (n.id !== newNodeId) return n;
        const execLog = {
          modelUsed: getHeaders()['x-provider-image']?.split('|')[1] || 'imagen-3.0',
          requestPayload: reqBody,
          error: err?.message || String(err),
          latencyMs: endMs - startMs,
          timestamp: startMs
        };
        return {
          ...n, 
          status: 'error', 
          versions: [{ 
            text: 'Visualization failed.',
            executionLog: execLog
          }],
          executionLog: execLog
        };
      }));
    }
  };

  const totalChars = nodes.reduce((acc, node) => acc + ((node.versions[node.versionIndex]?.text?.length) || 0), 0);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden dot-grid canvas-bg"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ cursor: isSpacePanMode || isDragging ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
    >
      {/* Draggable/Zoomable Canvas */}
      <div 
        className="absolute top-0 left-0 origin-top-left canvas-bg"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: '100%',
          height: '100%'
        }}
        onClick={(e) => {
          // Deselect if clicking on empty canvas
          if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
            setSelectedNodeIds([]);
          }
        }}
      >
        {/* Render Frames */}
        {frames.map((frame) => {
          const isEffectivelyCollapsed = frame.collapsed || transform.scale < 0.4;
          return (
          <div
            key={frame.id}
            style={{
              position: 'absolute',
              left: frame.x,
              top: frame.y,
              width: isEffectivelyCollapsed ? 300 : frame.width,
              height: isEffectivelyCollapsed ? 150 : frame.height,
              backgroundColor: isEffectivelyCollapsed ? '#e9d5ff' : 'rgba(233, 213, 255, 0.2)', // purple-200
              border: '2px solid #a855f7',
              borderRadius: '8px',
              zIndex: 0,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isEffectivelyCollapsed ? '8px 8px 0px #000' : 'none',
              transition: 'all 0.3s ease'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && frame.collapsed) {
                 // expand if clicking collapsed frame body
                 setFrames(frames.map(f => f.id === frame.id ? { ...f, collapsed: false } : f));
              }
            }}
          >
            <div className="flex justify-between items-center bg-purple-200 border-b-2 border-purple-500 p-2 rounded-t-[6px]">
              <input 
                value={frame.title}
                onChange={(e) => setFrames(frames.map(f => f.id === frame.id ? { ...f, title: e.target.value } : f))}
                className="font-mono font-bold text-sm bg-transparent outline-none w-full text-purple-900"
              />
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setFrames(frames.map(f => f.id === frame.id ? { ...f, collapsed: !f.collapsed } : f))}
                  className="hover:bg-purple-300 p-1 rounded transition-colors"
                  title="Toggle manual collapse"
                >
                  {frame.collapsed ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
                </button>
                <button 
                  onClick={() => setFrames(frames.filter(f => f.id !== frame.id))}
                  className="hover:bg-purple-300 p-1 rounded transition-colors text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {isEffectivelyCollapsed && (
              <div className="p-4 flex-1 flex flex-col justify-center items-center">
                <span className="font-mono font-bold text-4xl text-purple-900">{frame.nodeIds.length}</span>
                <span className="font-mono text-xs text-purple-700 uppercase tracking-widest mt-1">Nodes Inside</span>
              </div>
            )}
          </div>
        )})}

        <ConnectingLines hiddenNodeIds={nodes.filter(node => frames.some(f => (f.collapsed || transform.scale < 0.4) && f.nodeIds.includes(node.id))).map(n => n.id)} 
          nodes={nodes} 
          wireDragState={wireDragState}
          onEdgeClick={handleEdgeClick}
          onEdgeContextMenu={handleEdgeContextMenu}
        />
        {nodes.map((node, index) => {
          // Check if node is inside a collapsed frame
          const isHidden = frames.some(f => (f.collapsed || transform.scale < 0.4) && f.nodeIds.includes(node.id));
          if (isHidden) return null;

          // Spatial Virtualization
          // Only render nodes that are within the current viewport (with generous padding)
          const padding = 1500; 
          const viewportX = -transform.x / transform.scale;
          const viewportY = -transform.y / transform.scale;
          const viewportWidth = window.innerWidth / transform.scale;
          const viewportHeight = window.innerHeight / transform.scale;
          
          const isVisible = 
            (node.x + node.width + padding) >= viewportX &&
            (node.x - padding) <= viewportX + viewportWidth &&
            (node.y + 1200 + padding) >= viewportY && 
            (node.y - padding) <= viewportY + viewportHeight;

          if (!isVisible) return null;

          return (
            <NodeCard 
              key={node.id} 
              index={index}
              node={node} 
              selected={selectedNodeIds.includes(node.id)}
              highlighted={highlightedNodeId === node.id}
              onHoverCitation={(id) => setHighlightedNodeId(id)}
              onSelect={handleNodeSelect}
              onExpand={handleExpand}
              onRegenerate={handleRegenerate}
              onClose={handleDelete}
              setVersion={setVersion}
              onUpdateText={handleUpdateText}
              onUpdateSettings={handleUpdateSettings}
              onFracture={handleFracture}
              onVisualize={handleVisualize}
              onAutoMap={handleAutoMap}
              onPointerDown={(e) => handleNodePointerDown(e, node.id)}
              onPortDragStart={handlePortDragStart}
              onPortDrop={handlePortDrop}
              onCorrectionDrop={handleCorrectionDrop}
              onOpenDebug={setDebugNodeId}
              onStressTest={handleStressTest}
              onSynthesizeBranch={handleSynthesizeBranch}
              onFindEvidence={handleFindEvidence}
              onAlternateHypothesis={handleAlternateHypothesis}
              onChangeRole={handleChangeRole}
              isXRayMode={isXRayMode}
            />
          );
        })}
      </div>

      {/* Initial Search UI & Starter Canvases */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 z-20">
          <div className="text-center mb-3 pointer-events-auto">
            <span className="bg-black text-yellow-300 font-mono text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full shadow-md">
              Adversarial Reasoning & Decision Studio
            </span>
          </div>
          <h1 
            className="font-tomorrow font-bold text-4xl md:text-[54px] tracking-[-0.02em] mb-4 md:mb-3 text-black pointer-events-auto"
          >
            GRIDSCAPE
          </h1>
          <div className="pointer-events-auto w-full max-w-2xl bg-white border-2 border-black p-2 md:p-2 shadow-[4px_4px_0px_#000] md:shadow-[8px_8px_0px_#000] flex flex-col sm:flex-row gap-2 sm:gap-0">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex px-2 sm:px-4 items-center relative">
              <Search className="text-gray-400 mr-2 sm:mr-3 shrink-0" size={20} />
              <input
                autoFocus
                className="flex-1 outline-none font-sans text-base sm:text-lg lg:text-xl py-2 sm:py-3 w-full"
                placeholder="Enter a strategic premise, thesis, or dilemma..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileInputChange} 
                className="hidden" 
                accept="image/*,video/*,audio/*,application/pdf,text/plain"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer text-gray-400 hover:text-black"
                title="Ground with PDF, Paper, or Document"
              >
                <Paperclip size={20} />
              </button>
            </form>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={handleSearchSubmit}
                className="flex-1 sm:flex-none sm:w-12 h-12 bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors cursor-pointer"
                title="Begin Reasoning Graph"
              >
                <Play fill="currentColor" size={20} />
              </button>
              <button 
                onClick={handleMagicWand}
                className="flex-1 sm:flex-none sm:w-12 h-12 border-2 border-black text-black bg-yellow-100 flex items-center justify-center hover:bg-yellow-200 transition-colors cursor-pointer"
                title="Explore Adjacent Hypotheses"
              >
                <Sparkles size={20} />
              </button>
            </div>
          </div>

          {/* Quick-Launch Decision Frameworks */}
          <div className="pointer-events-auto mt-6 w-full max-w-2xl flex flex-col gap-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 font-bold px-1">
              Instant Decision Frameworks (Pre-Wired Graphs):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleLoadTemplate('pricing')}
                className="bg-white hover:bg-yellow-50 border-2 border-black p-3 text-left shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-900 mb-1">
                  <span className="text-sm">⚡</span>
                  <span>Hybrid AI Pricing</span>
                </div>
                <div className="text-[11px] text-gray-600 line-clamp-2">
                  Seat-based vs Usage token floor; procurement & churn stress-test.
                </div>
              </button>

              <button
                onClick={() => handleLoadTemplate('slm')}
                className="bg-white hover:bg-indigo-50 border-2 border-black p-3 text-left shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-900 mb-1">
                  <span className="text-sm">🔬</span>
                  <span>SLM vs Frontier</span>
                </div>
                <div className="text-[11px] text-gray-600 line-clamp-2">
                  Fine-tuned 8B inference vs remote API costs & hallucination limits.
                </div>
              </button>

              <button
                onClick={() => handleLoadTemplate('architecture')}
                className="bg-white hover:bg-cyan-50 border-2 border-black p-3 text-left shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-900 mb-1">
                  <span className="text-sm">🛡️</span>
                  <span>Monolith vs Microservices</span>
                </div>
                <div className="text-[11px] text-gray-600 line-clamp-2">
                  Latency overhead & dev velocity vs shared database lock contention.
                </div>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-[10px] md:text-xs font-mono text-gray-500 max-w-lg leading-relaxed uppercase tracking-widest px-4 md:px-0">
            NON-LINEAR REASONING • ADVERSARIAL STRESS-TESTING • VECTOR MEMORY GROUNDING • AUDIT-PROOF DECISIONS
          </div>
        </div>
      )}

      {/* Floating UI Elements */}
      
      {nodes.length > 0 && (
        <>
          {/* Capacity Badge & Selection Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none md:bottom-6 md:left-6 md:translate-x-0 flex flex-col md:flex-row gap-4 items-center md:items-end">
            <div className="bg-black text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full font-mono text-[8px] md:text-[10px] uppercase tracking-widest shadow-lg hidden md:block">
              CAPACITY: {nodes.length} NODES
            </div>
            
            <AnimatePresence>
              {selectedNodeIds.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="pointer-events-auto flex flex-col md:flex-row gap-2"
                >
                  <button
                    onClick={handleSynthesize}
                    className="bg-yellow-200 border-2 border-black text-black font-mono font-bold text-xs px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <Sparkles size={16} />
                    Synthesize {selectedNodeIds.length} Nodes
                  </button>
                  <button
                    onClick={handleCreateFrame}
                    className="bg-purple-200 border-2 border-black text-black font-mono font-bold text-xs px-6 py-3 rounded-full hover:bg-purple-300 transition-colors shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    Group into Frame
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tools Menu & Minimap */}
          <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 pointer-events-auto flex flex-col items-end gap-2 md:gap-4">
            <div className="hidden md:block">
              <Minimap
                nodes={nodes}
                transform={transform}
                onCenterViewport={handleCenterViewport}
              />
            </div>
            
            <div className="bg-black text-white p-1 rounded-xl flex items-center shadow-2xl">
              <div className="hidden sm:block px-4 font-mono text-[10px] min-w-[100px] text-center border-r border-gray-700">
                {totalChars} CHARS
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors mx-1 cursor-pointer"
                title="Upload Document or Image"
              >
                <Paperclip size={16} className="md:w-[18px] md:h-[18px]" />
              </button>

              <div className="w-[1px] h-6 bg-gray-700 mx-1"></div>
              
              <button 
                onClick={() => handleZoom(-0.2)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors mx-1 cursor-pointer"
              >
                <ZoomOut size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
              
              <button 
                onClick={() => handleZoom(0.2)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors mr-1 cursor-pointer"
              >
                <ZoomIn size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </div>
        </>
      )}
      {/* Global Main Menu (Top Left for Mobile Safety) */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 flex flex-col gap-2 pointer-events-auto z-50">
        <div className="flex gap-2">
          <button 
              onClick={() => setIsMainMenuOpen(!isMainMenuOpen)}
              className="bg-black text-white border-2 border-black w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_rgba(0,0,0,0.3)] cursor-pointer rounded-full"
          >
              {isMainMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button 
              onClick={() => setIsCheckpointsOpen(true)}
              className="bg-white text-black border-2 border-black w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-gray-200 transition-colors shadow-[4px_4px_0px_rgba(0,0,0,0.3)] cursor-pointer rounded-full"
              title="Time-Travel Checkpoints"
          >
              <History size={20} />
          </button>
        </div>
        {isMainMenuOpen && (
          <div className="bg-white border-2 border-black p-2 shadow-[4px_4px_0px_#000] flex flex-col gap-2 mt-2 w-48">
            <button 
                onClick={() => { setIsMultiSelectMode(!isMultiSelectMode); setIsMainMenuOpen(false); }}
                className={`text-left text-[10px] md:text-xs font-mono font-bold px-3 py-2 transition-colors cursor-pointer flex items-center gap-2 ${isMultiSelectMode ? "bg-purple-400 text-black" : "hover:bg-gray-100"}`}
            >
                [ MULTI-SELECT ]
            </button>
            <button 
                onClick={() => { setShowCustomNodeModal(true); setIsMainMenuOpen(false); }}
                className="text-left text-[10px] md:text-xs font-mono font-bold px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-2"
            >
                [ + CUSTOM NODE ]
            </button>
            <button 
                onClick={() => { setIsXRayMode(!isXRayMode); setIsMainMenuOpen(false); }}
                className={`text-left text-[10px] md:text-xs font-mono font-bold px-3 py-2 transition-colors cursor-pointer flex items-center gap-2 ${isXRayMode ? "bg-green-400 text-black" : "hover:bg-gray-100"}`}
            >
                [ X-RAY VISION ]
            </button>
            <button 
                onClick={() => {
                  setNodes([]);
                  setTransform({ x: 0, y: 0, scale: typeof window !== "undefined" && window.innerWidth < 768 ? 0.6 : 0.85 });
                  setIsMainMenuOpen(false);
                }}
                className="text-left text-[10px] md:text-xs font-mono font-bold px-3 py-2 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            >
                [ RESET CANVAS ]
            </button>
            <button 
                onClick={() => { handleExportBriefcase(); setIsMainMenuOpen(false); }}
                className="text-left text-[10px] md:text-xs font-mono font-bold px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-between"
            >
                <span>[ SAVE BRIEFCASE (.json) ]</span>
                <Download size={14} />
            </button>
            <label className="text-left text-[10px] md:text-xs font-mono font-bold px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-between">
                <span>[ LOAD BRIEFCASE (.json) ]</span>
                <Upload size={14} />
                <input type="file" accept=".json" className="hidden" onChange={handleImportBriefcase} />
            </label>
          </div>
        )}
      </div>

      {/* Global Top Right Controls */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 flex gap-2 pointer-events-auto">
        <button 
            onClick={() => setIsDecisionBriefOpen(true)}
            className="bg-amber-300 border-2 border-black text-[10px] md:text-xs font-mono font-bold px-3 py-2 md:px-4 md:py-2 hover:bg-amber-400 text-black transition-colors shadow-[2px_2px_0px_#000] md:shadow-[4px_4px_0px_#000] cursor-pointer flex items-center gap-1.5"
            title="Generate Audit-Proof Decision Brief"
        >
            <CheckCircle2 size={14} className="text-amber-900" />
            <span>[ DECISION BRIEF ]</span>
        </button>
        <button 
            onClick={handleAutoCluster}
            className="bg-white border-2 border-black text-[10px] md:text-xs font-mono font-bold px-3 py-2 md:px-4 md:py-2 hover:bg-yellow-200 transition-colors shadow-[2px_2px_0px_#000] md:shadow-[4px_4px_0px_#000] cursor-pointer flex items-center gap-2"
            title="Auto-Cluster Nodes (AI Librarian)"
        >
            <Sparkles size={14} />
            <span className="hidden sm:inline">[ CLUSTER ]</span>
        </button>
        <div className="bg-yellow-100 border-2 border-black text-[10px] md:text-xs font-mono font-bold px-3 py-2 md:px-4 md:py-2 flex items-center shadow-[2px_2px_0px_#000] md:shadow-[4px_4px_0px_#000]">
          {apiKeys.gemini ? `🔑 BYOK: ${selectedTextModel.split('|')[1]}` : '☁️ SYSTEM KEY'}
        </div>
        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white border-2 border-black text-[10px] md:text-xs font-mono font-bold px-3 py-2 md:px-4 md:py-2 hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_#000] md:shadow-[4px_4px_0px_#000] cursor-pointer flex items-center gap-2"
            title="Settings & API Key"
        >
            <Settings size={14} />
            <span className="hidden sm:inline">[ SETTINGS ]</span>
        </button>
      </div>

      {isSettingsOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg shadow-[8px_8px_0px_#000] p-6 relative flex flex-col gap-6">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <div>
                <h2 className="font-bold font-mono text-xl uppercase tracking-tight">Market-Level Config</h2>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mt-1">Unified API Infrastructure</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="hover:text-red-600 cursor-pointer self-start">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-2">
              <div className="bg-blue-50 border border-blue-200 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="font-bold font-mono text-xs text-blue-900 uppercase">Provider Models</span>
                </div>
                
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-bold text-gray-700">TEXT & LOGIC ENGINE</label>
                    <select 
                      value={selectedTextModel}
                      onChange={(e) => setSelectedTextModel(e.target.value)}
                      className="border-2 border-black p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <optgroup label="Google">
                        <option value="gemini|gemini-3.1-flash">Gemini 3.1 Flash</option>
                        <option value="gemini|gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                        <option value="gemini|gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                        <option value="gemini|gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                        <option value="gemini|gemini-3.1-flash">Gemini 3.1 Flash</option>
                        <option value="gemini|gemini-1.5-pro">Gemini 1.5 Pro</option>
                      </optgroup>
                      <optgroup label="Anthropic">
                        <option value="anthropic|claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="anthropic|claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                      </optgroup>
                      <optgroup label="OpenAI">
                        <option value="openai|gpt-4o">GPT-4o</option>
                        <option value="openai|gpt-4o-mini">GPT-4o-mini</option>
                      </optgroup>
                      <optgroup label="Groq (Fast)">
                        <option value="groq|llama3-8b-8192">Llama 3 8B</option>
                        <option value="groq|mixtral-8x7b-32768">Mixtral 8x7B</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-bold text-gray-700">IMAGE & VISION ENGINE</label>
                    <select 
                      value={selectedImageModel}
                      onChange={(e) => setSelectedImageModel(e.target.value)}
                      className="border-2 border-black p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <optgroup label="Google">
                        <option value="gemini|imagen-3.0-generate-002">Imagen 3.0</option>
                        <option value="gemini|imagen-3.0-fast-generate-001">Imagen 3.0 Fast</option>
                      </optgroup>
                      <optgroup label="OpenAI">
                        <option value="openai|dall-e-3">DALL-E 3</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 border-b border-gray-200 pb-3">
                  <label className="font-bold font-mono text-[10px] uppercase">Google API Key</label>
                  <input 
                    type="password"
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({...apiKeys, gemini: e.target.value})}
                    placeholder="AIzaSy..."
                    className="w-full border border-gray-400 p-2 font-mono text-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div className="flex flex-col gap-1 border-b border-gray-200 pb-3">
                  <label className="font-bold font-mono text-[10px] uppercase">OpenAI API Key</label>
                  <input 
                    type="password"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                    placeholder="sk-proj-..."
                    className="w-full border border-gray-400 p-2 font-mono text-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div className="flex flex-col gap-1 border-b border-gray-200 pb-3">
                  <label className="font-bold font-mono text-[10px] uppercase">Anthropic API Key</label>
                  <input 
                    type="password"
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKeys({...apiKeys, anthropic: e.target.value})}
                    placeholder="sk-ant-..."
                    className="w-full border border-gray-400 p-2 font-mono text-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold font-mono text-[10px] uppercase">Groq API Key</label>
                  <input 
                    type="password"
                    value={apiKeys.groq}
                    onChange={(e) => setApiKeys({...apiKeys, groq: e.target.value})}
                    placeholder="gsk_..."
                    className="w-full border border-gray-400 p-2 font-mono text-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-mono mt-1 leading-relaxed">
                  Keys are stored strictly in local browser storage. File uploads and visual ingestion currently fallback to Gemini if selected.
                </p>
              </div>
            </div>

            <button
              className="mt-2 bg-black text-white font-mono font-bold text-sm tracking-wide py-4 px-6 hover:bg-gray-800 transition-colors w-full border-2 border-black cursor-pointer shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] uppercase"
              onClick={() => {
                localStorage.setItem('gemini-api-key', apiKeys.gemini);
                localStorage.setItem('openai-api-key', apiKeys.openai);
                localStorage.setItem('anthropic-api-key', apiKeys.anthropic);
                localStorage.setItem('groq-api-key', apiKeys.groq);
                localStorage.setItem('selected-text-model', selectedTextModel);
                localStorage.setItem('selected-image-model', selectedImageModel);
                setIsSettingsOpen(false);
              }}
            >
              Initialize Network
            </button>
          </div>
        </div>
      )}

      {showCustomNodeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_#000] flex flex-col gap-4 relative">
            <button onClick={() => setShowCustomNodeModal(false)} className="absolute top-4 right-4 hover:text-gray-500"><X size={24} /></button>
            <h2 className="font-mono font-bold text-xl uppercase border-b-2 border-black pb-2">Create Custom Node</h2>
            
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs font-bold uppercase">Task / Prompt</label>
              <textarea
                value={customNodeConfig.prompt}
                onChange={e => setCustomNodeConfig({...customNodeConfig, prompt: e.target.value})}
                placeholder="What should this node do?"
                className="border-2 border-black p-2 font-sans text-sm resize-none h-24 outline-none focus:bg-yellow-50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs font-bold uppercase">AI Model</label>
              <select
                value={customNodeConfig.customModel}
                onChange={e => setCustomNodeConfig({...customNodeConfig, customModel: e.target.value})}
                className="border-2 border-black p-2 font-mono text-xs outline-none cursor-pointer bg-white"
              >
                <option value="">Default (Fast)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Heavy / Reasoning)</option>
                <option value="gemini-3.1-flash">Gemini 3.1 Flash (Fast)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs font-bold uppercase">Persona / Rules</label>
              <textarea
                value={customNodeConfig.persona}
                onChange={e => setCustomNodeConfig({...customNodeConfig, persona: e.target.value})}
                placeholder="e.g. Act as a ruthless editor, only output JSON, explain it like I am 5..."
                className="border-2 border-black p-2 font-sans text-sm resize-none h-20 outline-none focus:bg-yellow-50"
              />
            </div>

            <div className="flex items-center gap-3 mt-2">
              <input 
                type="checkbox" 
                id="isolateContext"
                checked={customNodeConfig.isolateContext}
                onChange={e => setCustomNodeConfig({...customNodeConfig, isolateContext: e.target.checked})}
                className="w-4 h-4 cursor-pointer accent-black"
              />
              <label htmlFor="isolateContext" className="font-mono text-xs font-bold cursor-pointer select-none">
                ISOLATE CONTEXT (Break memory chain)
              </label>
            </div>

            <button
              onClick={() => {
                if(!customNodeConfig.prompt) return;
                setShowCustomNodeModal(false);
                const spawnX = -transform.x / transform.scale + window.innerWidth / (2 * transform.scale);
                const spawnY = -transform.y / transform.scale + window.innerHeight / (2 * transform.scale);
                generateNode(
                  customNodeConfig.prompt,
                  spawnX,
                  spawnY,
                  undefined,
                  undefined,
                  false,
                  {
                    customModel: customNodeConfig.customModel || undefined,
                    persona: customNodeConfig.persona || undefined,
                    isolateContext: customNodeConfig.isolateContext
                  }
                );
                setCustomNodeConfig({ prompt: '', customModel: '', persona: '', isolateContext: false });
              }}
              className="mt-4 w-full bg-black text-white font-mono font-bold uppercase py-3 border-2 border-black hover:bg-white hover:text-black transition-colors"
            >
              Create Node
            </button>
          </div>
        </div>
      )}
      {showBillingModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#FFFBEA]/80 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg shadow-[4px_4px_0px_#000] md:shadow-[8px_8px_0px_#000] p-4 md:p-6 relative flex flex-col gap-4">
            <button 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-black bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              onClick={() => {
                setShowBillingModal(false);
                setPendingAction(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h2 className="font-sans font-bold text-lg md:text-xl pr-8 text-black leading-tight">
              This application uses premium AI models. You must select an API key from a Google Cloud project with a billing enabled. Free tier keys do not support these high end features.
            </h2>
            <p className="font-mono text-sm text-gray-700 leading-relaxed">
              Make sure your project is linked to a valid billing account. Check the pricing documentation for more details.
            </p>
            <button
              className="mt-2 bg-black text-white font-mono font-bold text-sm tracking-wide py-3 px-6 hover:bg-gray-800 transition-colors w-full border-2 border-black cursor-pointer"
              onClick={async () => {
                setShowBillingModal(false);
                if (window.aistudio && window.aistudio.openSelectKey) {
                  await window.aistudio.openSelectKey();
                  // Assume selection success to avoid delay
                  setHasLinkedKey(true);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                } else {
                  // Fallback if running outside aistudio
                  setHasLinkedKey(true);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }
              }}
            >
              SELECT API KEY
            </button>
          </div>
        </div>
      )}

      {isCheckpointsOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg shadow-[8px_8px_0px_#000] p-6 relative flex flex-col gap-6">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <div>
                <h2 className="font-bold font-mono text-xl uppercase tracking-tight">Time-Travel Checkpoints</h2>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mt-1">Canvas Snapshots & Rollback</p>
              </div>
              <button onClick={() => setIsCheckpointsOpen(false)} className="hover:text-red-600 cursor-pointer self-start">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2">
              {checkpoints.length === 0 ? (
                <div className="text-center p-8 text-gray-500 font-mono text-sm border-2 border-dashed border-gray-300">
                  <Clock size={32} className="mx-auto mb-2 opacity-50" />
                  No checkpoints saved yet.<br/>Save your current canvas state to time-travel back to it later.
                </div>
              ) : (
                checkpoints.map((cp) => (
                  <div key={cp.id} className="border-2 border-black p-3 bg-gray-50 hover:bg-yellow-50 transition-colors flex items-center justify-between group">
                    <div className="flex flex-col cursor-pointer flex-1" onClick={() => handleRestoreCheckpoint(cp)}>
                      <span className="font-bold font-mono text-sm">{cp.name}</span>
                      <span className="font-mono text-[10px] text-gray-500">{new Date(cp.timestamp).toLocaleString()} • {cp.nodes.length} Nodes</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCheckpoint(cp.id); }} 
                      className="p-2 hover:bg-red-100 hover:text-red-600 border-2 border-transparent hover:border-red-200 transition-colors cursor-pointer"
                      title="Delete Checkpoint"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleSaveCheckpoint}
              className="mt-2 w-full bg-black text-white font-mono font-bold uppercase py-3 border-2 border-black hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save Current Canvas
            </button>
          </div>
        </div>
      )}

      {debugNodeId && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white border-2 border-black w-full max-w-2xl shadow-[8px_8px_0px_#000] p-6 relative flex flex-col gap-4 max-h-[80vh]">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <div>
                <h2 className="font-bold font-mono text-xl uppercase tracking-tight flex items-center gap-2 text-red-600">
                  <Bug size={24} /> Execution Log
                </h2>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mt-1">Node ID: {debugNodeId}</p>
              </div>
              <button onClick={() => setDebugNodeId(null)} className="hover:text-red-600 cursor-pointer self-start">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 font-mono text-xs flex flex-col gap-4">
              {nodes.find(n => n.id === debugNodeId)?.executionLog ? (
                <>
                  <div className="bg-gray-100 p-2 border border-gray-300">
                    <LatencyChart data={nodes.find(n => n.id === debugNodeId)?.versions
                      .map((v, i) => ({
                        generation: i + 1,
                        latency: v.executionLog?.latencyMs || 0,
                        status: (v.executionLog?.error ? 'error' : 'success') as 'success' | 'error'
                      }))
                      .filter(d => d.latency > 0) || []} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-100 p-2 border border-gray-300">
                      <span className="font-bold uppercase text-gray-500 text-[10px] block mb-1">Model Used</span>
                      {nodes.find(n => n.id === debugNodeId)?.executionLog?.modelUsed}
                    </div>
                    <div className="bg-gray-100 p-2 border border-gray-300">
                      <span className="font-bold uppercase text-gray-500 text-[10px] block mb-1">Latency</span>
                      {nodes.find(n => n.id === debugNodeId)?.executionLog?.latencyMs}ms
                    </div>
                  </div>

                  {nodes.find(n => n.id === debugNodeId)?.executionLog?.error && (
                    <div className="bg-red-50 text-red-600 p-3 border border-red-200 whitespace-pre-wrap">
                      <span className="font-bold block mb-1 uppercase">Error:</span>
                      {nodes.find(n => n.id === debugNodeId)?.executionLog?.error}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="font-bold uppercase text-gray-500 text-[10px]">Request Payload (JSON)</span>
                    <pre className="bg-gray-900 text-green-400 p-3 overflow-x-auto border border-black rounded-sm">
                      {JSON.stringify(nodes.find(n => n.id === debugNodeId)?.executionLog?.requestPayload, null, 2)}
                    </pre>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-bold uppercase text-gray-500 text-[10px]">Response Payload (JSON)</span>
                    <pre className="bg-gray-900 text-blue-400 p-3 overflow-x-auto border border-black rounded-sm">
                      {JSON.stringify(nodes.find(n => n.id === debugNodeId)?.executionLog?.responsePayload, null, 2)}
                    </pre>
                  </div>

                  {nodes.find(n => n.id === debugNodeId)?.executionLog?.retrievedChunks && (
                    <div className="flex flex-col gap-2 bg-yellow-50 border-2 border-black p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-black text-[11px] flex items-center gap-1.5">
                          🧠 Semantic Vector Memory Hits ({nodes.find(n => n.id === debugNodeId)?.executionLog?.retrievedChunks?.length})
                        </span>
                        <span className="text-[10px] text-gray-600 uppercase font-mono">Cosine Similarity</span>
                      </div>
                      <div className="flex flex-col gap-2 mt-1">
                        {nodes.find(n => n.id === debugNodeId)?.executionLog?.retrievedChunks?.map((chunk, cIdx) => (
                          <div key={chunk.id || cIdx} className="bg-white border border-black p-2 shadow-[2px_2px_0px_#000]">
                            <div className="flex items-center justify-between text-[10px] font-bold pb-1 border-b border-gray-200">
                              <span className="truncate max-w-[280px]">{chunk.sourceName}: {chunk.heading || 'Chunk'}</span>
                              <span className="bg-black text-white px-1.5 py-0.5 rounded text-[9px] font-mono">
                                {Math.round(chunk.score * 100)}% match
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-800 line-clamp-3 mt-1 font-sans">{chunk.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  <Bug size={32} className="mx-auto mb-2 opacity-50" />
                  No execution logs available for this node.<br/>Logs are captured during new generations.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Brief Modal */}
      {isDecisionBriefOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white border-2 border-black w-full max-w-3xl shadow-[8px_8px_0px_#000] p-6 relative flex flex-col gap-4 max-h-[85vh]">
            <div className="flex justify-between items-center border-b-2 border-black pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-300 text-amber-950 font-mono text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-amber-600">
                    Audit-Proof Synthesis
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {nodes.length} Nodes in Reasoning Graph
                  </span>
                </div>
                <h2 className="font-bold font-mono text-2xl uppercase tracking-tight text-gray-900 mt-1">
                  Executive Decision Brief
                </h2>
              </div>
              <button 
                onClick={() => setIsDecisionBriefOpen(false)} 
                className="hover:text-red-600 cursor-pointer self-start p-1"
              >
                <X size={22} />
              </button>
            </div>

            {/* Epistemic Stat Badges */}
            <div className="grid grid-cols-4 gap-2 font-mono text-xs">
              <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-sm">
                <span className="text-[10px] text-indigo-700 block uppercase font-bold">Hypotheses</span>
                <span className="text-xl font-bold text-indigo-950">{nodes.filter(n => n.role === 'hypothesis').length}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-sm">
                <span className="text-[10px] text-rose-700 block uppercase font-bold">Stress-Tests</span>
                <span className="text-xl font-bold text-rose-950">{nodes.filter(n => n.role === 'stress_test').length}</span>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 p-2.5 rounded-sm">
                <span className="text-[10px] text-cyan-700 block uppercase font-bold">Ground Truth</span>
                <span className="text-xl font-bold text-cyan-950">{nodes.filter(n => n.role === 'evidence').length}</span>
              </div>
              <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-sm">
                <span className="text-[10px] text-amber-800 block uppercase font-bold">Resolved Verdicts</span>
                <span className="text-xl font-bold text-amber-950">{nodes.filter(n => n.role === 'decision').length}</span>
              </div>
            </div>

            {/* Formatted Markdown Preview */}
            <div className="overflow-y-auto pr-2 bg-slate-50 border border-slate-300 p-4 rounded-sm max-h-[48vh] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-gray-800">
              {getDecisionBriefMarkdown()}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getDecisionBriefMarkdown());
                  setCopiedBrief(true);
                  setTimeout(() => setCopiedBrief(false), 2000);
                }}
                className="flex-1 bg-black text-white hover:bg-gray-800 font-mono font-bold text-xs uppercase py-3 border-2 border-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
              >
                {copiedBrief ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                <span>{copiedBrief ? "Copied to Clipboard!" : "Copy Full Markdown Brief"}</span>
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([getDecisionBriefMarkdown()], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `decision-brief-${Date.now()}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-white hover:bg-gray-100 text-black font-mono font-bold text-xs uppercase py-3 px-6 border-2 border-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
              >
                <Download size={16} />
                <span>Download .md</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
