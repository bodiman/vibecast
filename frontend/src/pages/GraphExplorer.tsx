import React, { useState, useEffect, useCallback } from 'react';
import GraphViewer3D from '../components/GraphViewer3D';
import { apiClient } from '../api/client';
import type { GraphData, GraphNode, GraphEdge } from '../types/api';

export default function GraphExplorer() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<'force' | 'circular' | 'hierarchical'>('force');

  // Test connection and fetch available models
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const isConnected = await apiClient.testConnection();
        if (isConnected) {
          const models = await apiClient.getModels();
          if (models.length > 0) {
            setSelectedModel(models[0]);
          }
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
      }
    };

    initializeApp();
  }, []);

  // Fetch graph data for selected model
  useEffect(() => {
    if (!selectedModel) return;

    const fetchGraphData = async () => {
      setLoading(true);
      
      try {
        const data = await apiClient.getGraphData(selectedModel);
        setGraphData(data);
      } catch (err) {
        console.error('Failed to fetch graph data:', err);
        // Use sample data as fallback
        setGraphData({
          nodes: [
            { id: '1', name: 'Revenue', type: 'scalar', values: [100, 110, 121] },
            { id: '2', name: 'COGS', type: 'scalar', values: [30, 33, 36] },
            { id: '3', name: 'EBITDA', type: 'scalar', values: [70, 77, 85] },
            { id: '4', name: 'Cash', type: 'series', values: [50, 120, 162] },
            { id: '5', name: 'Growth Rate', type: 'parameter', values: [0.1] }
          ],
          edges: [
            { id: 'e1', source: '1', target: '3', type: 'formula' },
            { id: 'e2', source: '2', target: '3', type: 'formula' },
            { id: 'e3', source: '3', target: '4', type: 'temporal' },
            { id: 'e4', source: '5', target: '1', type: 'causal' }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [selectedModel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setLayoutAlgorithm('force');
            break;
          case '2':
            event.preventDefault();
            setLayoutAlgorithm('circular');
            break;
          case '3':
            event.preventDefault();
            setLayoutAlgorithm('hierarchical');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    console.log('Node clicked:', node);
  }, []);

  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    console.log('Edge clicked:', edge);
  }, []);

  const handleLayoutChange = useCallback((nodePositions: Record<string, { x: number; y: number; z: number }>) => {
    console.log('Layout changed:', nodePositions);
  }, []);

  const displayData = graphData.nodes.length > 0 ? graphData : {
    nodes: [
      { id: '1', name: 'Revenue', type: 'scalar', values: [100, 110, 121] },
      { id: '2', name: 'COGS', type: 'scalar', values: [30, 33, 36] },
      { id: '3', name: 'EBITDA', type: 'scalar', values: [70, 77, 85] },
      { id: '4', name: 'Cash', type: 'series', values: [50, 120, 162] },
      { id: '5', name: 'Growth Rate', type: 'parameter', values: [0.1] }
    ],
    edges: [
      { id: 'e1', source: '1', target: '3', type: 'formula' },
      { id: 'e2', source: '2', target: '3', type: 'formula' },
      { id: 'e3', source: '3', target: '4', type: 'temporal' },
      { id: 'e4', source: '5', target: '1', type: 'causal' }
    ]
  } as GraphData;

  return (
    <div className="w-screen h-screen bg-black">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <GraphViewer3D
          data={displayData}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onLayoutChange={handleLayoutChange}
          layoutAlgorithm={layoutAlgorithm}
          width={window.innerWidth}
          height={window.innerHeight}
        />
      )}
    </div>
  );
}