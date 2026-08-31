import React from 'react';
import { GridNodeData, EdgeType } from '../types';

export interface WireDragState {
  sourceId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ConnectingLinesProps {
  nodes: GridNodeData[];
  hiddenNodeIds?: string[];
  wireDragState: WireDragState | null;
  onEdgeClick?: (nodeId: string, sourceId: string) => void;
  onEdgeContextMenu?: (e: React.MouseEvent, nodeId: string, sourceId: string) => void;
}

const getEdgeStyle = (type?: EdgeType, bandwidth?: 'immediate' | 'lineage') => {
  let style = { stroke: 'black', strokeWidth: '2', strokeDasharray: '6 4' };
  switch (type) {
    case 'source_of_truth': style = { stroke: '#3b82f6', strokeWidth: '4', strokeDasharray: 'none' }; break;
    case 'style_reference': style = { stroke: '#ec4899', strokeWidth: '3', strokeDasharray: '4 4' }; break;
    case 'counter_argument': style = { stroke: '#f97316', strokeWidth: '3', strokeDasharray: '8 4' }; break;
    case 'correction': style = { stroke: '#ef4444', strokeWidth: '5', strokeDasharray: 'none' }; break; // Red bold line
  }
  
  if (bandwidth === 'lineage') {
    style.strokeWidth = (parseInt(style.strokeWidth) + 4).toString();
    style.strokeDasharray = 'none'; // Solid for thick lineage wires
  }
  
  return style;
};

export const ConnectingLines: React.FC<ConnectingLinesProps> = ({ nodes, hiddenNodeIds = [], wireDragState, onEdgeClick, onEdgeContextMenu }) => {
  return (
    <svg 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible'
      }}
    >
      {nodes.flatMap(node => {
        // Collect edges from both legacy parentIds and incomingEdges
        const edges = [...(node.incomingEdges || [])];
        if (node.parentIds) {
          node.parentIds.forEach(pid => {
            if (!edges.some(e => e.sourceId === pid)) {
              edges.push({ sourceId: pid, type: 'default' });
            }
          });
        }
        
        if (edges.length === 0) return [];
        
        return edges.map(edge => {
          if (hiddenNodeIds.includes(node.id) || hiddenNodeIds.includes(edge.sourceId)) return null;
          
          const parent = nodes.find(n => n.id === edge.sourceId);
          if (!parent) return null;

          const startX = parent.x + parent.width;
          const startY = parent.y + Math.min(200, parent.fileData || parent.versions[0]?.imageUrl ? 150 : 100); 

          const endX = node.x; 
          const endY = node.y + Math.min(200, node.fileData || node.versions[0]?.imageUrl ? 150 : 100);

          const cp1X = startX + (endX - startX) / 2;
          const cp1Y = startY;
          const cp2X = cp1X;
          const cp2Y = endY;

          const style = getEdgeStyle(edge.type, edge.bandwidth);
          if (node.status === 'generating') {
            style.stroke = '#3b82f6';
            style.strokeDasharray = '6 4';
          }

          return (
            <g 
              key={`line-${node.id}-${edge.sourceId}`} 
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }} 
              onClick={() => onEdgeClick?.(node.id, edge.sourceId)}
              onContextMenu={(e) => {
                if (onEdgeContextMenu) {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdgeContextMenu(e, node.id, edge.sourceId);
                }
              }}
            >
              <path
                d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                fill="none"
                stroke="transparent"
                strokeWidth="20" // Hit area
              />
              <path
                d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                fill="none"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                className={node.status === 'generating' ? 'animate-pulse' : ''}
              />
              {edge.label && (
                <g transform={`translate(${(startX + endX) / 2}, ${(startY + endY) / 2})`}>
                  <rect 
                    x="-50" y="-10" width="100" height="20" fill="white" stroke="black" strokeWidth="1" rx="4"
                    transform="translate(0, 0)"
                  />
                  <text 
                    x="0" y="4" fontSize="10" fontWeight="bold" textAnchor="middle" fill="black"
                    className="uppercase tracking-wider font-mono"
                  >
                    {edge.label.length > 15 ? edge.label.substring(0, 15) + '...' : edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        });
      })}

      {/* Active dragging wire */}
      {wireDragState && (
        <path
          d={`M ${wireDragState.startX} ${wireDragState.startY} C ${wireDragState.startX + (wireDragState.currentX - wireDragState.startX) / 2} ${wireDragState.startY}, ${wireDragState.startX + (wireDragState.currentX - wireDragState.startX) / 2} ${wireDragState.currentY}, ${wireDragState.currentX} ${wireDragState.currentY}`}
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
};
