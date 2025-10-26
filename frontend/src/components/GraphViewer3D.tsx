import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphNode, GraphEdge, GraphData } from '../types/api';

interface GraphViewer3DProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onLayoutChange?: (positions: Record<string, { x: number; y: number; z: number }>) => void;
  layoutAlgorithm?: 'force' | 'circular' | 'hierarchical';
  width?: number;
  height?: number;
}

// Node component
function Node({ 
  node, 
  position, 
  onClick, 
  isSelected, 
  onHoverChange,
  isConnected = false
}: { 
  node: GraphNode; 
  position: [number, number, number];
  onClick: () => void;
  isSelected: boolean;
  onHoverChange: (hovered: boolean) => void;
  isConnected?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Color based on node type
  const color = useMemo(() => {
    switch (node.type) {
      case 'scalar': return '#4f46e5'; // Purple
      case 'series': return '#059669'; // Green
      case 'parameter': return '#dc2626'; // Red
      default: return '#6b7280'; // Gray
    }
  }, [node.type]);
  
  // Size based on importance or connections
  const size = useMemo(() => {
    const baseSize = 0.8;
    const valueMultiplier = node.values?.length ? Math.log(node.values.length + 1) * 0.2 : 0;
    return baseSize + valueMultiplier;
  }, [node.values]);
  
  // Use ref for smooth scale animation
  const scaleRef = useRef(1);
  const targetScale = hovered || isSelected ? 1.2 : (isConnected ? 1.1 : 1);
  
  // Smooth scale interpolation
  useFrame(() => {
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 0.1);
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  });

  const handleClick = useCallback((event: any) => {
    event.stopPropagation();
    console.log('🎯 Node mesh clicked:', node.name);
    onClick();
  }, [onClick, node.name]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerEnter={() => {
          setHovered(true);
          onHoverChange(true);
        }}
        onPointerLeave={() => {
          setHovered(false);
          onHoverChange(false);
        }}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={hovered || isSelected ? 0.9 : (isConnected ? 0.8 : 0.7)}
          emissive={isSelected ? color : (isConnected ? color : '#000000')}
          emissiveIntensity={isSelected ? 0.2 : (isConnected ? 0.1 : 0)}
        />
      </mesh>
      
      {/* Node label */}
      <Text
        position={[0, size + 0.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
      >
        {node.name}
      </Text>
      
      {/* Hover info */}
      {hovered && (
        <Html distanceFactor={10}>
          <div className="bg-black bg-opacity-80 text-white p-2 rounded max-w-xs">
            <div className="font-bold">{node.name}</div>
            <div className="text-sm">Type: {node.type}</div>
            {node.values && (
              <div className="text-sm">Values: {node.values.length} points</div>
            )}
            {node.metadata?.description && (
              <div className="text-sm mt-1">{node.metadata.description}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Edge component
function Edge({ 
  edge, 
  sourcePosition, 
  targetPosition, 
  onClick,
  isHighlighted = false
}: { 
  edge: GraphEdge;
  sourcePosition: [number, number, number];
  targetPosition: [number, number, number];
  onClick: () => void;
  isHighlighted?: boolean;
}) {
  const lineRef = useRef<THREE.BufferGeometry>(null);
  const [hovered, setHovered] = useState(false);
  
  // Create line geometry
  const points = useMemo(() => [
    new THREE.Vector3(...sourcePosition),
    new THREE.Vector3(...targetPosition)
  ], [sourcePosition, targetPosition]);
  
  // Color based on edge type
  const color = useMemo(() => {
    switch (edge.type) {
      case 'formula': return '#f59e0b'; // Amber
      case 'temporal': return '#8b5cf6'; // Purple
      case 'causal': return '#ef4444'; // Red
      case 'derived': return '#10b981'; // Emerald
      default: return '#6b7280'; // Gray
    }
  }, [edge.type]);

  return (
    <group>
      <line
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <bufferGeometry ref={lineRef}>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
            args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color={color} 
          linewidth={hovered || isHighlighted ? 3 : 1}
          transparent
          opacity={hovered || isHighlighted ? 1 : 0.6}
        />
      </line>
      
      {/* Arrow head */}
      <mesh position={targetPosition}>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// Main 3D Scene component
function Scene({ 
  data, 
  onNodeClick, 
  onEdgeClick, 
  onLayoutChange,
  layoutAlgorithm = 'force'
}: {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onLayoutChange?: (positions: Record<string, { x: number; y: number; z: number }>) => void;
  layoutAlgorithm?: 'force' | 'circular' | 'hierarchical';
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, [number, number, number]>>({});
  const [layoutEnabled, setLayoutEnabled] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const frameCountRef = useRef(0);
  const hoverCountRef = useRef(0);
  
  // Initialize node positions based on layout algorithm
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {};
    
    data.nodes.forEach((node, index) => {
      if (node.position3D && layoutAlgorithm === 'force') {
        // Use saved positions for force-directed layout
        positions[node.id] = [node.position3D.x, node.position3D.y, node.position3D.z];
      } else {
        // Calculate position based on layout algorithm
        switch (layoutAlgorithm) {
          case 'circular':
            const angle = (index / data.nodes.length) * Math.PI * 2;
            const radius = Math.max(data.nodes.length * 0.5, 5);
            positions[node.id] = [
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              0
            ];
            break;
            
          case 'hierarchical':
            // Simple hierarchical layout based on connections
            const inDegree = data.edges.filter(e => e.target === node.id).length;
            const level = Math.min(inDegree, 5); // Max 5 levels
            const nodesAtLevel = data.nodes.filter((_, i) => {
              const nodeInDegree = data.edges.filter(e => e.target === data.nodes[i].id).length;
              return Math.min(nodeInDegree, 5) === level;
            }).length;
            const positionInLevel = data.nodes.filter((_, i) => {
              const nodeInDegree = data.edges.filter(e => e.target === data.nodes[i].id).length;
              return Math.min(nodeInDegree, 5) === level && i <= index;
            }).length;
            
            positions[node.id] = [
              (positionInLevel - nodesAtLevel / 2) * 3,
              level * 4 - 10,
              (Math.random() - 0.5) * 2
            ];
            break;
            
          case 'force':
          default:
            // Random initial positions for force-directed
            const radius2 = Math.sqrt(data.nodes.length) * 2;
            positions[node.id] = [
              (Math.random() - 0.5) * radius2,
              (Math.random() - 0.5) * radius2,
              (Math.random() - 0.5) * 4
            ];
            break;
        }
      }
    });
    
    setNodePositions(positions);
    setLayoutEnabled(layoutAlgorithm === 'force'); // Only enable animation for force-directed
    frameCountRef.current = 0; // Reset frame counter
  }, [data, layoutAlgorithm]);
  
  // Handle hover state changes
  const handleNodeHover = useCallback((nodeId: string | null, hovered: boolean) => {
    if (hovered) {
      hoverCountRef.current++;
      setHoveredNode(nodeId);
    } else {
      hoverCountRef.current = Math.max(0, hoverCountRef.current - 1);
      if (hoverCountRef.current === 0) {
        setHoveredNode(null);
      }
    }
    setIsHovering(hoverCountRef.current > 0);
  }, []);


  // Simple force-directed layout simulation with throttling
  useFrame(() => {
    if (data.nodes.length === 0 || !layoutEnabled || isHovering || selectedNode) return;
    
    // Throttle layout updates - only run every 3rd frame for performance
    frameCountRef.current++;
    if (frameCountRef.current % 3 !== 0) return;
    
    const newPositions = { ...nodePositions };
    const dt = 0.048; // Adjusted for 20fps (60/3)
    const repulsion = 5;
    const attraction = 0.1;
    const damping = 0.95;
    
    // Boundary constraints for invisible walls
    const bounds = {
      x: 12,  // ±12 units in X
      y: 8,   // ±8 units in Y  
      z: 6    // ±6 units in Z
    };
    const bounceDamping = 0.8; // Energy loss on bounce
    
    // Apply forces
    data.nodes.forEach(node => {
      if (!newPositions[node.id]) return;
      
      let [x, y, z] = newPositions[node.id];
      let fx = 0, fy = 0, fz = 0;
      
      // Repulsion from other nodes
      data.nodes.forEach(other => {
        if (node.id === other.id || !newPositions[other.id]) return;
        
        const [ox, oy, oz] = newPositions[other.id];
        const dx = x - ox;
        const dy = y - oy;
        const dz = z - oz;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance > 0) {
          const force = repulsion / (distance * distance);
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
          fz += (dz / distance) * force;
        }
      });
      
      // Attraction along edges
      data.edges.forEach(edge => {
        if (edge.source === node.id && newPositions[edge.target]) {
          const [tx, ty, tz] = newPositions[edge.target];
          const dx = tx - x;
          const dy = ty - y;
          const dz = tz - z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distance > 0) {
            fx += dx * attraction;
            fy += dy * attraction;
            fz += dz * attraction;
          }
        }
      });
      
      // Calculate proposed new position
      let newX = x + fx * dt * damping;
      let newY = y + fy * dt * damping;
      let newZ = z + fz * dt * damping;
      
      // Apply boundary collision detection and bounce
      let velocityX = fx * dt * damping;
      let velocityY = fy * dt * damping;
      let velocityZ = fz * dt * damping;
      
      // X boundaries
      if (newX > bounds.x) {
        newX = bounds.x;
        velocityX = -Math.abs(velocityX) * bounceDamping;
        newX += velocityX;
      } else if (newX < -bounds.x) {
        newX = -bounds.x;
        velocityX = Math.abs(velocityX) * bounceDamping;
        newX += velocityX;
      }
      
      // Y boundaries
      if (newY > bounds.y) {
        newY = bounds.y;
        velocityY = -Math.abs(velocityY) * bounceDamping;
        newY += velocityY;
      } else if (newY < -bounds.y) {
        newY = -bounds.y;
        velocityY = Math.abs(velocityY) * bounceDamping;
        newY += velocityY;
      }
      
      // Z boundaries
      if (newZ > bounds.z) {
        newZ = bounds.z;
        velocityZ = -Math.abs(velocityZ) * bounceDamping;
        newZ += velocityZ;
      } else if (newZ < -bounds.z) {
        newZ = -bounds.z;
        velocityZ = Math.abs(velocityZ) * bounceDamping;
        newZ += velocityZ;
      }
      
      newPositions[node.id] = [newX, newY, newZ];
    });
    
    // Check if layout has stabilized (small movement)
    let totalMovement = 0;
    data.nodes.forEach(node => {
      if (nodePositions[node.id] && newPositions[node.id]) {
        const oldPos = nodePositions[node.id];
        const newPos = newPositions[node.id];
        const movement = Math.sqrt(
          Math.pow(newPos[0] - oldPos[0], 2) +
          Math.pow(newPos[1] - oldPos[1], 2) +
          Math.pow(newPos[2] - oldPos[2], 2)
        );
        totalMovement += movement;
      }
    });
    
    // Stop animation if movement is very small (earlier termination)
    if (totalMovement < 0.05 && frameCountRef.current > 180) {
      setLayoutEnabled(false);
    }
    
    setNodePositions(newPositions);
  });
  
  const handleNodeClick = useCallback((node: GraphNode) => {
    // Toggle selection - unselect if already selected
    setSelectedNode(prev => prev === node.id ? null : node.id);
    onNodeClick?.(node);
  }, [onNodeClick]);
  
  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    onEdgeClick?.(edge);
  }, [onEdgeClick]);
  
  
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />
      
      {/* Render nodes */}
      {data.nodes.map(node => {
        const position = nodePositions[node.id] || [0, 0, 0];
        
        // Check if this node is connected to the selected node
        const isConnectedToSelected = selectedNode && data.edges.some(edge => 
          (edge.source === selectedNode && edge.target === node.id) ||
          (edge.target === selectedNode && edge.source === node.id)
        );
        
        return (
          <Node
            key={node.id}
            node={node}
            position={position}
            onClick={() => handleNodeClick(node)}
            isSelected={selectedNode === node.id}
            onHoverChange={(hovered) => handleNodeHover(node.id, hovered)}
            isConnected={isConnectedToSelected}
          />
        );
      })}
      
      {/* Render edges */}
      {data.edges.map(edge => {
        const sourcePos = nodePositions[edge.source];
        const targetPos = nodePositions[edge.target];
        
        if (!sourcePos || !targetPos) return null;
        
        // Determine if this edge should be highlighted
        // Highlight for both hover and selection
        const isHighlighted = (hoveredNode && (
          edge.source === hoveredNode || edge.target === hoveredNode
        )) || (selectedNode && (
          edge.source === selectedNode || edge.target === selectedNode
        ));
        
        return (
          <Edge
            key={edge.id}
            edge={edge}
            sourcePosition={sourcePos}
            targetPosition={targetPos}
            onClick={() => handleEdgeClick(edge)}
            isHighlighted={isHighlighted}
          />
        );
      })}
      
      {/* Grid */}
      <gridHelper args={[20, 20, '#333333', '#333333']} />
    </>
  );
}

// NodeInfoCard component for detailed node information
function NodeInfoCard({ 
  node, 
  data, 
  onClose,
  position = { x: 20, y: 20 }
}: {
  node: GraphNode;
  data: GraphData;
  onClose: () => void;
  position?: { x: number; y: number };
}) {
  // Calculate dependencies
  const incomingEdges = data.edges.filter(edge => edge.target === node.id);
  const outgoingEdges = data.edges.filter(edge => edge.source === node.id);
  
  // Get dependency nodes
  const dependencies = incomingEdges.map(edge => {
    const sourceNode = data.nodes.find(n => n.id === edge.source);
    return { edge, node: sourceNode };
  }).filter(dep => dep.node);
  
  const dependents = outgoingEdges.map(edge => {
    const targetNode = data.nodes.find(n => n.id === edge.target);
    return { edge, node: targetNode };
  }).filter(dep => dep.node);

  return (
    <div 
      className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 max-w-md min-w-72"
      style={{ 
        left: position.x, 
        top: position.y, 
        zIndex: 10000,
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-bold text-lg">{node.name}</h3>
          <p className="text-gray-400 text-sm capitalize">{node.type}</p>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Description */}
      {node.metadata?.description && (
        <div className="mb-3">
          <p className="text-gray-300 text-sm">{node.metadata.description}</p>
        </div>
      )}

      {/* Values */}
      {node.values && node.values.length > 0 && (
        <div className="mb-3">
          <h4 className="text-white font-semibold text-sm mb-1">Values</h4>
          <div className="text-gray-300 text-sm">
            {node.values.length === 1 ? (
              <span>{node.values[0]}{node.metadata?.units && ` ${node.metadata.units}`}</span>
            ) : (
              <span>{node.values.length} data points: [{node.values.slice(0, 3).join(', ')}{node.values.length > 3 ? '...' : ''}]{node.metadata?.units && ` ${node.metadata.units}`}</span>
            )}
          </div>
        </div>
      )}

      {/* Formula */}
      {node.type === 'formula' && node.metadata?.formula && (
        <div className="mb-3">
          <h4 className="text-white font-semibold text-sm mb-1">Formula</h4>
          <code className="text-green-400 text-sm bg-gray-800 px-2 py-1 rounded">
            {node.metadata.formula}
          </code>
        </div>
      )}

      {/* Dependencies */}
      {dependencies.length > 0 && (
        <div className="mb-3">
          <h4 className="text-white font-semibold text-sm mb-2">Dependencies</h4>
          <div className="space-y-1">
            {dependencies.map(({ edge, node: depNode }) => (
              <div key={edge.id} className="flex items-center text-sm">
                <div 
                  className="w-3 h-0.5 mr-2"
                  style={{ backgroundColor: getEdgeColor(edge.type) }}
                ></div>
                <span className="text-gray-300">{depNode?.name}</span>
                <span className="text-gray-500 ml-auto text-xs capitalize">{edge.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependents */}
      {dependents.length > 0 && (
        <div className="mb-3">
          <h4 className="text-white font-semibold text-sm mb-2">Affects</h4>
          <div className="space-y-1">
            {dependents.map(({ edge, node: depNode }) => (
              <div key={edge.id} className="flex items-center text-sm">
                <div 
                  className="w-3 h-0.5 mr-2"
                  style={{ backgroundColor: getEdgeColor(edge.type) }}
                ></div>
                <span className="text-gray-300">{depNode?.name}</span>
                <span className="text-gray-500 ml-auto text-xs capitalize">{edge.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No dependencies message */}
      {dependencies.length === 0 && dependents.length === 0 && (
        <div className="text-gray-500 text-sm">
          No dependencies or relationships found.
        </div>
      )}
    </div>
  );
}

// Helper function to get edge colors
function getEdgeColor(edgeType: string): string {
  switch (edgeType) {
    case 'formula': return '#f59e0b'; // Amber
    case 'temporal': return '#8b5cf6'; // Purple
    case 'causal': return '#ef4444'; // Red
    case 'derived': return '#10b981'; // Emerald
    default: return '#6b7280'; // Gray
  }
}

// Main GraphViewer3D component
export default function GraphViewer3D({ 
  data, 
  onNodeClick, 
  onEdgeClick, 
  onLayoutChange,
  layoutAlgorithm = 'force',
  width = 800,
  height = 600
}: GraphViewer3DProps) {
  console.log('GraphViewer3D render:', { nodeCount: data.nodes.length, edgeCount: data.edges.length });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [infoCardNode, setInfoCardNode] = useState<GraphNode | null>(null);

  const handleNodeClick = useCallback((node: GraphNode) => {
    console.log('🔍 Node clicked:', node.name, node.id);
    console.log('🔍 Previous infoCardNode:', infoCardNode?.name);
    // Always show the card for the clicked node (no toggle)
    setInfoCardNode(node);
    console.log('🔍 New infoCardNode will be:', node.name);
    onNodeClick?.(node);
  }, [onNodeClick, infoCardNode]);

  const handleCloseInfoCard = useCallback(() => {
    setInfoCardNode(null);
  }, []);

  // Close info card when clicking outside or pressing escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInfoCardNode(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Only close if clicking on the canvas area, not on the info card
      if (canvasRef.current && canvasRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.node-info-card')) {
          setInfoCardNode(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  // Show loading state if no data
  if (!data || data.nodes.length === 0) {
    return (
      <div style={{ width, height, position: 'relative' }} className="bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-lg font-semibold">Loading Graph...</div>
          <div className="text-sm text-gray-400 mt-2">Preparing 3D visualization</div>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={canvasRef} style={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ 
          position: [10, 10, 10], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        style={{ background: '#0f0f0f' }}
        gl={{ antialias: true, alpha: false }}
        dpr={window.devicePixelRatio}
      >
        <Scene 
          data={data}
          onNodeClick={handleNodeClick}
          onEdgeClick={onEdgeClick}
          onLayoutChange={onLayoutChange}
          layoutAlgorithm={layoutAlgorithm}
        />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
        />
        {/* Stats removed to prevent overlay issues */}
      </Canvas>
      
      {/* Info Card Overlay */}
      {console.log('📋 Rendering infoCardNode:', infoCardNode?.name || 'none')}
      {infoCardNode && (
        <div className="node-info-card" style={{ zIndex: 9999 }}>
          <NodeInfoCard
            node={infoCardNode}
            data={data}
            onClose={handleCloseInfoCard}
            position={{ x: 20, y: 20 }}
          />
        </div>
      )}
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-90 backdrop-blur text-white p-3 rounded-lg border border-gray-700">
        <div className="text-xs space-y-1">
          <div className="text-gray-300">🖱️ Drag to rotate • 🔍 Scroll to zoom</div>
          <div className="text-gray-300">📱 Right-click to pan • 👆 Click to select</div>
        </div>
      </div>
    </div>
  );
}