import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html, Stats } from '@react-three/drei';
import * as THREE from 'three';

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  values?: any;
  metadata?: any;
  position3D?: { x: number; y: number; z: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  formula?: string;
  metadata?: any;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphViewer3DProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onLayoutChange?: (positions: Record<string, { x: number; y: number; z: number }>) => void;
  width?: number;
  height?: number;
}

// Node component
function Node({ 
  node, 
  position, 
  onClick, 
  isSelected, 
  onPositionChange 
}: { 
  node: GraphNode; 
  position: [number, number, number];
  onClick: () => void;
  isSelected: boolean;
  onPositionChange: (position: [number, number, number]) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const { camera, raycaster, mouse } = useThree();
  
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

  useFrame(() => {
    if (meshRef.current && isDragging) {
      // Update position during drag
      const currentPosition = meshRef.current.position;
      onPositionChange([currentPosition.x, currentPosition.y, currentPosition.z]);
    }
  });

  const handlePointerDown = useCallback((event: THREE.Event) => {
    event.stopPropagation();
    setIsDragging(true);
    onClick();
  }, [onClick]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePointerMove = useCallback((event: THREE.Event) => {
    if (isDragging && meshRef.current) {
      // Simple drag implementation - in real app you'd want proper 3D dragging
      const mesh = meshRef.current;
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectionPoint);
      
      mesh.position.copy(intersectionPoint);
    }
  }, [isDragging, camera, raycaster, mouse]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        scale={hovered || isSelected ? [1.2, 1.2, 1.2] : [1, 1, 1]}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={hovered || isSelected ? 0.9 : 0.7}
          emissive={isSelected ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
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
        font="/fonts/Inter-Regular.woff" // You'd need to add this font
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
  onClick 
}: { 
  edge: GraphEdge;
  sourcePosition: [number, number, number];
  targetPosition: [number, number, number];
  onClick: () => void;
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
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color={color} 
          linewidth={hovered ? 3 : 1}
          transparent
          opacity={hovered ? 1 : 0.6}
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
  onLayoutChange 
}: {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onLayoutChange?: (positions: Record<string, { x: number; y: number; z: number }>) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, [number, number, number]>>({});
  
  // Initialize node positions with force-directed layout
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {};
    
    data.nodes.forEach((node, index) => {
      if (node.position3D) {
        positions[node.id] = [node.position3D.x, node.position3D.y, node.position3D.z];
      } else {
        // Simple circular layout as fallback
        const angle = (index / data.nodes.length) * Math.PI * 2;
        const radius = Math.sqrt(data.nodes.length) * 2;
        positions[node.id] = [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          (Math.random() - 0.5) * 4
        ];
      }
    });
    
    setNodePositions(positions);
  }, [data]);
  
  // Simple force-directed layout simulation
  useFrame(() => {
    if (data.nodes.length === 0) return;
    
    const newPositions = { ...nodePositions };
    const dt = 0.016; // 60fps
    const repulsion = 5;
    const attraction = 0.1;
    const damping = 0.9;
    
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
      
      // Update position
      newPositions[node.id] = [
        x + fx * dt * damping,
        y + fy * dt * damping,
        z + fz * dt * damping
      ];
    });
    
    setNodePositions(newPositions);
  });
  
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id);
    onNodeClick?.(node);
  }, [onNodeClick]);
  
  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    onEdgeClick?.(edge);
  }, [onEdgeClick]);
  
  const handleNodePositionChange = useCallback((nodeId: string, position: [number, number, number]) => {
    setNodePositions(prev => ({ ...prev, [nodeId]: position }));
    
    // Notify parent of layout changes
    if (onLayoutChange) {
      const positions: Record<string, { x: number; y: number; z: number }> = {};
      Object.entries({ ...nodePositions, [nodeId]: position }).forEach(([id, pos]) => {
        positions[id] = { x: pos[0], y: pos[1], z: pos[2] };
      });
      onLayoutChange(positions);
    }
  }, [nodePositions, onLayoutChange]);
  
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />
      
      {/* Render nodes */}
      {data.nodes.map(node => {
        const position = nodePositions[node.id] || [0, 0, 0];
        return (
          <Node
            key={node.id}
            node={node}
            position={position}
            onClick={() => handleNodeClick(node)}
            isSelected={selectedNode === node.id}
            onPositionChange={(pos) => handleNodePositionChange(node.id, pos)}
          />
        );
      })}
      
      {/* Render edges */}
      {data.edges.map(edge => {
        const sourcePos = nodePositions[edge.source];
        const targetPos = nodePositions[edge.target];
        
        if (!sourcePos || !targetPos) return null;
        
        return (
          <Edge
            key={edge.id}
            edge={edge}
            sourcePosition={sourcePos}
            targetPosition={targetPos}
            onClick={() => handleEdgeClick(edge)}
          />
        );
      })}
      
      {/* Grid */}
      <gridHelper args={[20, 20, '#333333', '#333333']} />
    </>
  );
}

// Main GraphViewer3D component
export default function GraphViewer3D({ 
  data, 
  onNodeClick, 
  onEdgeClick, 
  onLayoutChange,
  width = 800,
  height = 600
}: GraphViewer3DProps) {
  return (
    <div style={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ 
          position: [10, 10, 10], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        style={{ background: '#0f0f0f' }}
      >
        <Scene 
          data={data}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onLayoutChange={onLayoutChange}
        />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
        />
        <Stats />
      </Canvas>
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white p-3 rounded">
        <div className="text-sm font-bold">Graph Statistics</div>
        <div className="text-xs">Nodes: {data.nodes.length}</div>
        <div className="text-xs">Edges: {data.edges.length}</div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded">
        <div className="text-xs">
          <div>🖱️ Drag to rotate</div>
          <div>🔍 Scroll to zoom</div>
          <div>📱 Right-click to pan</div>
          <div>👆 Click nodes/edges to select</div>
        </div>
      </div>
    </div>
  );
}