import React, { useState, useEffect, useCallback } from 'react';
import GraphViewer3D, { GraphData, GraphNode, GraphEdge } from './components/GraphViewer3D';

interface GraphExplorerProps {
  apiBaseUrl?: string;
}

export default function GraphExplorer({ apiBaseUrl = '' }: GraphExplorerProps) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/models`);
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
          if (data.models && data.models.length > 0) {
            setSelectedModel(data.models[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        setError('Failed to fetch models');
      }
    };

    fetchModels();
  }, [apiBaseUrl]);

  // Fetch graph data for selected model
  useEffect(() => {
    if (!selectedModel) return;

    const fetchGraphData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${apiBaseUrl}/api/models/${selectedModel}/graph`);
        if (response.ok) {
          const data = await response.json();
          setGraphData(data);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        console.error('Failed to fetch graph data:', err);
        setError(`Failed to fetch graph data: ${err instanceof Error ? err.message : String(err)}`);
        setGraphData({ nodes: [], edges: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [selectedModel, apiBaseUrl]);

  // Handle node selection
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  // Handle edge selection
  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  // Handle layout changes
  const handleLayoutChange = useCallback(async (positions: Record<string, { x: number; y: number; z: number }>) => {
    if (!selectedModel) return;

    try {
      await fetch(`${apiBaseUrl}/api/models/${selectedModel}/layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodePositions: positions }),
      });
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [selectedModel, apiBaseUrl]);

  // Create sample data if no API is available
  const sampleData: GraphData = {
    nodes: [
      { id: 'revenue', name: 'Revenue', type: 'series', values: [100, 110, 120, 130] },
      { id: 'costs', name: 'Costs', type: 'series', values: [80, 85, 90, 95] },
      { id: 'profit', name: 'Profit', type: 'scalar', values: [20, 25, 30, 35] },
      { id: 'margin', name: 'Margin', type: 'parameter', values: [0.2] },
      { id: 'growth', name: 'Growth Rate', type: 'parameter', values: [0.1] },
    ],
    edges: [
      { id: 'rev-profit', source: 'revenue', target: 'profit', type: 'formula', formula: 'revenue - costs' },
      { id: 'costs-profit', source: 'costs', target: 'profit', type: 'formula', formula: 'revenue - costs' },
      { id: 'margin-profit', source: 'margin', target: 'profit', type: 'derived' },
      { id: 'growth-revenue', source: 'growth', target: 'revenue', type: 'temporal' },
    ]
  };

  const displayData = graphData.nodes.length > 0 ? graphData : sampleData;

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-900 text-white p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Context Marketplace</h1>
        <h2 className="text-lg font-semibold mb-4">3D Graph Explorer</h2>
        
        {/* Model selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
          >
            <option value="">Choose a model...</option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-200">
            {error}
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-900 border border-blue-700 rounded text-blue-200">
            Loading graph data...
          </div>
        )}

        {/* Graph statistics */}
        <div className="mb-6">
          <h3 className="text-md font-semibold mb-2">Graph Statistics</h3>
          <div className="text-sm text-gray-300">
            <div>Nodes: {displayData.nodes.length}</div>
            <div>Edges: {displayData.edges.length}</div>
            <div>Types: {new Set(displayData.nodes.map(n => n.type)).size}</div>
          </div>
        </div>

        {/* Selected node details */}
        {selectedNode && (
          <div className="mb-6">
            <h3 className="text-md font-semibold mb-2">Selected Node</h3>
            <div className="bg-gray-800 p-3 rounded">
              <div className="font-medium">{selectedNode.name}</div>
              <div className="text-sm text-gray-300">Type: {selectedNode.type}</div>
              {selectedNode.values && (
                <div className="text-sm text-gray-300">
                  Values: [{selectedNode.values.slice(0, 3).join(', ')}
                  {selectedNode.values.length > 3 ? '...' : ''}]
                </div>
              )}
              {selectedNode.metadata?.description && (
                <div className="text-sm text-gray-300 mt-2">
                  {selectedNode.metadata.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected edge details */}
        {selectedEdge && (
          <div className="mb-6">
            <h3 className="text-md font-semibold mb-2">Selected Edge</h3>
            <div className="bg-gray-800 p-3 rounded">
              <div className="font-medium">{selectedEdge.source} → {selectedEdge.target}</div>
              <div className="text-sm text-gray-300">Type: {selectedEdge.type}</div>
              {selectedEdge.formula && (
                <div className="text-sm text-gray-300">
                  Formula: {selectedEdge.formula}
                </div>
              )}
              {selectedEdge.metadata?.description && (
                <div className="text-sm text-gray-300 mt-2">
                  {selectedEdge.metadata.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mb-6">
          <h3 className="text-md font-semibold mb-2">Node Types</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-purple-500 rounded-full mr-2"></div>
              <span>Scalar</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
              <span>Series</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
              <span>Parameter</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-md font-semibold mb-2">Edge Types</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-1 bg-yellow-500 mr-2"></div>
              <span>Formula</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-1 bg-purple-500 mr-2"></div>
              <span>Temporal</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-1 bg-red-500 mr-2"></div>
              <span>Causal</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-1 bg-green-500 mr-2"></div>
              <span>Derived</span>
            </div>
          </div>
        </div>

        {/* API Info */}
        <div className="text-xs text-gray-500 mt-8">
          {models.length === 0 && !loading && !error && (
            <div>
              <div className="mb-2">No API connection - showing sample data</div>
              <div>To connect to real data:</div>
              <div>1. Start the server with database</div>
              <div>2. Access via /graph endpoint</div>
            </div>
          )}
        </div>
      </div>

      {/* Main content - 3D Viewer */}
      <div className="flex-1 relative">
        <GraphViewer3D
          data={displayData}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onLayoutChange={handleLayoutChange}
          width={window.innerWidth - 320}
          height={window.innerHeight}
        />
        
        {/* Floating info panel */}
        {selectedModel && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded">
            <div className="font-bold">Current Model</div>
            <div className="text-sm">{selectedModel}</div>
          </div>
        )}
      </div>
    </div>
  );
}