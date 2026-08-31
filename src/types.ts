export type EdgeType = 'default' | 'source_of_truth' | 'style_reference' | 'counter_argument' | 'correction';

export interface EdgeConnection {
  sourceId: string;
  type: EdgeType;
  bandwidth?: 'immediate' | 'lineage';
  sourceQuote?: string; // For micro-wiring: the specific highlighted text this edge comes from
  label?: string; // For GraphRAG connections
}

export interface FrameData {
  id: string;
  title: string;
  nodeIds: string[];
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  prompt: string;
  asciiArt?: string;
  text?: string;
  prompts?: string[];
  status: 'generating' | 'ready' | 'error' | 'idle';
  versionIndex: number;
  versions: NodeVersion[];
  parentIds?: string[];
  incomingEdges?: EdgeConnection[];
  type?: 'source' | 'lens' | 'default';
  settings?: {
    customModel?: string;
    persona?: string;
    isolateContext?: boolean;
    mapLevel?: 'broad' | 'balanced' | 'detailed';
    capability?: 'none' | 'search';
  };
  fileData?: {
    mimeType: string;
    data?: string; // legacy base64
    uri?: string;  // Gemini File API uri
    name?: string; // Original filename
    localUrl?: string; // Object URL for browser preview
    chunks?: { text: string, embedding: number[] }[]; // Attention Mapping chunks
  };
  memorySnapshot?: string; // Background compression block
  executionLog?: ExecutionLog; // Pinpoint Debugging
}

export interface ExecutionLog {
  modelUsed?: string;
  requestPayload?: any;
  responsePayload?: any;
  error?: string;
  latencyMs?: number;
  timestamp: number;
}

export interface NodeVersion {
  prompt?: string;
  asciiArt?: string;
  text?: string;
  prompts?: string[];
  imageUrl?: string; // For Visualize Lens
  imageLoading?: boolean;
  executionLog?: ExecutionLog;
}

export interface Checkpoint {
  id: string;
  timestamp: number;
  name: string;
  nodes: GridNodeData[];
  frames: FrameData[];
}

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<boolean | void>;
    };
  }
}
