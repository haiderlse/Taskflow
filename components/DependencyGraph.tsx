import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Task, User, Project, ColumnId } from '../types';
import { 
  NetworkIcon, 
  ZoomInIcon, 
  ZoomOutIcon, 
  RefreshCwIcon, 
  LockClosedIcon, 
  LockOpenIcon, 
  LinkIcon, 
  UnlinkIcon,
  XIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  FilterIcon, 
  SearchIcon, 
  ArrowRightIcon, 
  PlusIcon 
} from './icons';

interface DependencyGraphProps {
  project: Project;
  tasks: Task[];
  users: User[];
  currentUser?: User;
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  task: Task;
  title: string;
  status: ColumnId;
  priority: string;
  assignee?: User;
  isBlocked: boolean;
  blockerCount: number;
  dependentCount: number;
  unresolvedBlockerCount: number;
  level: number; // Hierarchical level
  width: number;
  height: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  isResolved: boolean; // Blocker task is 'Done'
}

type LayoutMode = 'hierarchical' | 'force' | 'radial';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 76;

const DependencyGraph: React.FC<DependencyGraphProps> = ({
  project,
  tasks,
  users,
  currentUser,
  onTaskClick,
  onTaskUpdate
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Controls state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('hierarchical');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'blocked' | 'ready' | 'in-progress' | 'done'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Quick dependency connection state
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [newSourceId, setNewSourceId] = useState('');
  const [newTargetId, setNewTargetId] = useState('');

  // Zoom transform reference for programmatic zoom controls
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height: 600
  });

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth || 900,
          height: containerRef.current.clientHeight || 600
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Map of users by uid for fast lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.uid, u));
    return map;
  }, [users]);

  // Build graph nodes & links from current tasks
  const { nodes, links, stats } = useMemo(() => {
    const taskMap = new Map<string, Task>();
    tasks.forEach(t => taskMap.set(t.id, t));

    // Calculate dependencies
    const linkList: GraphLink[] = [];
    const linkSet = new Set<string>();

    tasks.forEach(task => {
      const blockers = task.blockedBy || task.dependencies || [];
      blockers.forEach(blockerId => {
        if (taskMap.has(blockerId)) {
          const linkId = `${blockerId}->${task.id}`;
          if (!linkSet.has(linkId)) {
            linkSet.add(linkId);
            const blockerTask = taskMap.get(blockerId)!;
            linkList.push({
              id: linkId,
              source: blockerId,
              target: task.id,
              isResolved: blockerTask.status === 'Done'
            });
          }
        }
      });

      const dependents = task.blocking || [];
      dependents.forEach(depId => {
        if (taskMap.has(depId)) {
          const linkId = `${task.id}->${depId}`;
          if (!linkSet.has(linkId)) {
            linkSet.add(linkId);
            linkList.push({
              id: linkId,
              source: task.id,
              target: depId,
              isResolved: task.status === 'Done'
            });
          }
        }
      });
    });

    // Compute node levels (topological generation for DAG / hierarchical)
    const inDegreeMap = new Map<string, number>();
    const outNeighborsMap = new Map<string, string[]>();
    tasks.forEach(t => {
      inDegreeMap.set(t.id, 0);
      outNeighborsMap.set(t.id, []);
    });

    linkList.forEach(link => {
      const src = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const tgt = typeof link.target === 'string' ? link.target : (link.target as any).id;
      if (inDegreeMap.has(tgt)) {
        inDegreeMap.set(tgt, (inDegreeMap.get(tgt) || 0) + 1);
      }
      if (outNeighborsMap.has(src)) {
        outNeighborsMap.get(src)!.push(tgt);
      }
    });

    // BFS / topological level assignment
    const levels = new Map<string, number>();
    const queue: string[] = [];
    inDegreeMap.forEach((deg, id) => {
      if (deg === 0) {
        levels.set(id, 0);
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLevel = levels.get(curr) || 0;
      const neighbors = outNeighborsMap.get(curr) || [];
      neighbors.forEach(next => {
        const nextLevel = Math.max(levels.get(next) || 0, currLevel + 1);
        levels.set(next, nextLevel);
        queue.push(next);
      });
    }

    // Prepare Node Objects
    let blockedCount = 0;
    let resolvedBlockedCount = 0;
    let completedCount = 0;

    const nodeList: GraphNode[] = tasks.map(task => {
      const blockers = (task.blockedBy || task.dependencies || [])
        .map(id => taskMap.get(id))
        .filter(Boolean) as Task[];

      const unresolved = blockers.filter(b => b.status !== 'Done');
      const isBlocked = unresolved.length > 0 || (blockers.length === 0 && (task.blockedBy?.length || 0) > 0);
      const dependents = (task.blocking || []).filter(id => taskMap.has(id));

      if (task.status === 'Done') completedCount++;
      if (isBlocked && task.status !== 'Done') blockedCount++;
      if (!isBlocked && blockers.length > 0 && task.status !== 'Done') resolvedBlockedCount++;

      return {
        id: task.id,
        task,
        title: task.title,
        status: task.status,
        priority: task.priority || 'medium',
        assignee: task.assigneeId ? usersMap.get(task.assigneeId) : undefined,
        isBlocked: isBlocked && task.status !== 'Done',
        blockerCount: blockers.length,
        dependentCount: dependents.length,
        unresolvedBlockerCount: unresolved.length,
        level: levels.get(task.id) || 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      };
    });

    return {
      nodes: nodeList,
      links: linkList,
      stats: {
        totalTasks: tasks.length,
        totalLinks: linkList.length,
        blockedTasks: blockedCount,
        readyTasks: tasks.length - blockedCount - completedCount,
        completedTasks: completedCount
      }
    };
  }, [tasks, usersMap]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedTaskId) return null;
    return nodes.find(n => n.id === selectedTaskId) || null;
  }, [selectedTaskId, nodes]);

  // Compute Active Highlighted Task IDs (Ancestors & Descendants of selected/hovered node)
  const highlightedIds = useMemo(() => {
    const targetId = selectedTaskId || hoveredTaskId;
    if (!targetId) return null;

    const connected = new Set<string>([targetId]);
    const incomingMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();

    links.forEach(l => {
      const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (!outgoingMap.has(src)) outgoingMap.set(src, []);
      if (!incomingMap.has(tgt)) incomingMap.set(tgt, []);
      outgoingMap.get(src)!.push(tgt);
      incomingMap.get(tgt)!.push(src);
    });

    // Walk upstream (blockers)
    const upstreamQueue = [targetId];
    while (upstreamQueue.length > 0) {
      const curr = upstreamQueue.shift()!;
      const parents = incomingMap.get(curr) || [];
      parents.forEach(p => {
        if (!connected.has(p)) {
          connected.add(p);
          upstreamQueue.push(p);
        }
      });
    }

    // Walk downstream (dependents)
    const downstreamQueue = [targetId];
    while (downstreamQueue.length > 0) {
      const curr = downstreamQueue.shift()!;
      const children = outgoingMap.get(curr) || [];
      children.forEach(c => {
        if (!connected.has(c)) {
          connected.add(c);
          downstreamQueue.push(c);
        }
      });
    }

    return connected;
  }, [selectedTaskId, hoveredTaskId, links]);

  // Filter nodes according to Search & Status
  const filteredNodeIds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return new Set(
      nodes
        .filter(n => {
          const matchSearch = !q || n.title.toLowerCase().includes(q) || n.assignee?.displayName.toLowerCase().includes(q);
          if (!matchSearch) return false;

          if (statusFilter === 'blocked') return n.isBlocked;
          if (statusFilter === 'ready') return !n.isBlocked && n.status !== 'Done';
          if (statusFilter === 'in-progress') return n.status === 'In Progress';
          if (statusFilter === 'done') return n.status === 'Done';
          return true;
        })
        .map(n => n.id)
    );
  }, [nodes, searchQuery, statusFilter]);

  // Handle adding new dependency
  const handleCreateDependency = async () => {
    if (!newSourceId || !newTargetId || newSourceId === newTargetId || !onTaskUpdate) return;

    const targetTask = tasks.find(t => t.id === newTargetId);
    if (!targetTask) return;

    const currentBlockers = targetTask.blockedBy || targetTask.dependencies || [];
    if (!currentBlockers.includes(newSourceId)) {
      const updatedBlockers = [...currentBlockers, newSourceId];
      onTaskUpdate(newTargetId, {
        blockedBy: updatedBlockers,
        dependencies: updatedBlockers
      });

      // Update source task blocking
      const sourceTask = tasks.find(t => t.id === newSourceId);
      if (sourceTask) {
        const currentBlocking = sourceTask.blocking || [];
        if (!currentBlocking.includes(newTargetId)) {
          onTaskUpdate(newSourceId, {
            blocking: [...currentBlocking, newTargetId]
          });
        }
      }
    }

    setNewSourceId('');
    setNewTargetId('');
    setShowAddLinkModal(false);
  };

  // Handle removing a link
  const handleRemoveDependency = (sourceId: string, targetId: string) => {
    if (!onTaskUpdate) return;
    const targetTask = tasks.find(t => t.id === targetId);
    if (targetTask) {
      const currentBlockers = targetTask.blockedBy || targetTask.dependencies || [];
      const updated = currentBlockers.filter(id => id !== sourceId);
      onTaskUpdate(targetId, { blockedBy: updated, dependencies: updated });
    }

    const sourceTask = tasks.find(t => t.id === sourceId);
    if (sourceTask) {
      const currentBlocking = sourceTask.blocking || [];
      const updated = currentBlocking.filter(id => id !== targetId);
      onTaskUpdate(sourceId, { blocking: updated });
    }
  };

  // Zoom control helpers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.25);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth || 900;
      const height = containerRef.current.clientHeight || 600;
      d3.select(svgRef.current)
        .transition()
        .duration(600)
        .call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(width / 6, height / 8).scale(0.85)
        );
    }
  }, []);

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup defs (arrowheads, filters, gradients)
    const defs = svg.append('defs');

    // Normal Arrow
    defs.append('marker')
      .attr('id', 'arrow-default')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', '#94a3b8');

    // Blocked / Incomplete Arrow (Amber/Red)
    defs.append('marker')
      .attr('id', 'arrow-blocked')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', '#ef4444');

    // Resolved / Completed Arrow (Emerald Green)
    defs.append('marker')
      .attr('id', 'arrow-resolved')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', '#10b981');

    // Highlighted Arrow
    defs.append('marker')
      .attr('id', 'arrow-highlight')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', '#3b82f6');

    // Drop shadow filter for active nodes
    const filter = defs.append('filter')
      .attr('id', 'node-shadow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');

    filter.append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '4')
      .attr('stdDeviation', '4')
      .attr('flood-color', '#0f172a')
      .attr('flood-opacity', '0.12');

    // Root Group for Zooming
    const g = svg.append('g').attr('class', 'graph-root');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial positioning by layout mode
    const graphNodes: GraphNode[] = nodes.map(d => ({ ...d }));
    const graphLinks: GraphLink[] = links.map(d => ({ ...d }));

    if (layoutMode === 'hierarchical') {
      // Group by level
      const levelGroups = new Map<number, GraphNode[]>();
      graphNodes.forEach(node => {
        const lvl = node.level || 0;
        if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
        levelGroups.get(lvl)!.push(node);
      });

      const LEVEL_SPACING_X = 290;
      const NODE_SPACING_Y = 110;

      levelGroups.forEach((groupNodes, level) => {
        const startY = (height - groupNodes.length * NODE_SPACING_Y) / 2 + 30;
        groupNodes.forEach((node, index) => {
          node.x = 100 + level * LEVEL_SPACING_X;
          node.y = Math.max(60, startY + index * NODE_SPACING_Y);
          node.fx = node.x;
          node.fy = node.y;
        });
      });
    } else if (layoutMode === 'radial') {
      const radius = Math.min(width, height) * 0.38;
      const angleStep = (2 * Math.PI) / (graphNodes.length || 1);
      graphNodes.forEach((node, idx) => {
        const angle = idx * angleStep;
        node.x = width / 2 + radius * Math.cos(angle);
        node.y = height / 2 + radius * Math.sin(angle);
      });
    }

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(graphNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphLinks).id(d => d.id).distance(layoutMode === 'hierarchical' ? 240 : 180))
      .force('charge', d3.forceManyBody().strength(layoutMode === 'hierarchical' ? -150 : -450))
      .force('collide', d3.forceCollide().radius(NODE_WIDTH / 1.7))
      .force('center', layoutMode === 'hierarchical' ? null : d3.forceCenter(width / 2, height / 2));

    // Links container
    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');

    // Draw Links
    const linkElements = linkGroup.selectAll<SVGPathElement, GraphLink>('path')
      .data(graphLinks)
      .enter()
      .append('path')
      .attr('class', 'dependency-link')
      .attr('fill', 'none')
      .attr('stroke-width', (d) => {
        const srcId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tgtId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        const isHighlighted = highlightedIds?.has(srcId) && highlightedIds?.has(tgtId);
        return isHighlighted ? 3 : 2;
      })
      .attr('stroke-dasharray', d => d.isResolved ? '4,4' : 'none')
      .attr('stroke', (d) => {
        const srcId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tgtId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        const isHighlighted = highlightedIds?.has(srcId) && highlightedIds?.has(tgtId);
        if (isHighlighted) return '#3b82f6';
        return d.isResolved ? '#10b981' : '#f87171';
      })
      .attr('marker-end', (d) => {
        const srcId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tgtId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        const isHighlighted = highlightedIds?.has(srcId) && highlightedIds?.has(tgtId);
        if (isHighlighted) return 'url(#arrow-highlight)';
        return d.isResolved ? 'url(#arrow-resolved)' : 'url(#arrow-blocked)';
      })
      .attr('opacity', (d) => {
        if (!highlightedIds) return 0.85;
        const srcId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tgtId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        return (highlightedIds.has(srcId) && highlightedIds.has(tgtId)) ? 1 : 0.15;
      });

    // Draw Nodes
    const nodeElements = nodeGroup.selectAll<SVGGElement, GraphNode>('g')
      .data(graphNodes)
      .enter()
      .append('g')
      .attr('class', 'task-node cursor-pointer')
      .attr('filter', 'url(#node-shadow)')
      .attr('opacity', (d) => {
        const matchesFilter = filteredNodeIds.has(d.id);
        if (!matchesFilter) return 0.2;
        if (!highlightedIds) return 1;
        return highlightedIds.has(d.id) ? 1 : 0.25;
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedTaskId(prev => (prev === d.id ? null : d.id));
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if (onTaskClick) onTaskClick(d.task);
      })
      .on('mouseenter', (event, d) => {
        setHoveredTaskId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredTaskId(null);
      });

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (layoutMode !== 'hierarchical') {
          d.fx = null;
          d.fy = null;
        }
      });

    nodeElements.call(drag);

    // Node Card Background Box
    nodeElements.append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('x', -NODE_WIDTH / 2)
      .attr('y', -NODE_HEIGHT / 2)
      .attr('fill', d => {
        if (d.status === 'Done') return '#ffffff';
        if (d.isBlocked) return '#fff5f5';
        return '#ffffff';
      })
      .attr('stroke', (d) => {
        if (selectedTaskId === d.id) return '#2563eb';
        if (d.isBlocked) return '#ef4444';
        if (d.status === 'Done') return '#10b981';
        if (d.status === 'In Progress') return '#3b82f6';
        return '#cbd5e1';
      })
      .attr('stroke-width', (d) => (selectedTaskId === d.id ? 3 : d.isBlocked ? 2 : 1.5));

    // Priority indicator bar on left edge
    nodeElements.append('rect')
      .attr('width', 5)
      .attr('height', NODE_HEIGHT - 12)
      .attr('rx', 2.5)
      .attr('x', -NODE_WIDTH / 2 + 4)
      .attr('y', -NODE_HEIGHT / 2 + 6)
      .attr('fill', d => {
        switch (d.priority) {
          case 'critical': return '#ef4444';
          case 'high': return '#f97316';
          case 'medium': return '#3b82f6';
          case 'low': return '#94a3b8';
          default: return '#94a3b8';
        }
      });

    // Task Title
    nodeElements.append('text')
      .attr('x', -NODE_WIDTH / 2 + 16)
      .attr('y', -NODE_HEIGHT / 2 + 22)
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .attr('fill', d => d.status === 'Done' ? '#64748b' : '#0f172a')
      .attr('text-decoration', d => d.status === 'Done' ? 'line-through' : 'none')
      .text(d => {
        const maxLen = 20;
        return d.title.length > maxLen ? d.title.slice(0, maxLen) + '…' : d.title;
      });

    // Status Pill
    const pillGroup = nodeElements.append('g')
      .attr('transform', `translate(${-NODE_WIDTH / 2 + 16}, ${-NODE_HEIGHT / 2 + 32})`);

    pillGroup.append('rect')
      .attr('width', d => {
        const text = d.status;
        return text.length * 7 + 14;
      })
      .attr('height', 18)
      .attr('rx', 9)
      .attr('fill', d => {
        if (d.status === 'Done') return '#d1fae5';
        if (d.status === 'In Progress') return '#dbeafe';
        return '#f1f5f9';
      });

    pillGroup.append('text')
      .attr('x', 7)
      .attr('y', 13)
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', d => {
        if (d.status === 'Done') return '#065f46';
        if (d.status === 'In Progress') return '#1e40af';
        return '#475569';
      })
      .text(d => d.status);

    // Dependency Indicator Pill on bottom right (Blocked / Blocks / Ready)
    const depBadge = nodeElements.append('g')
      .attr('transform', `translate(${NODE_WIDTH / 2 - 82}, ${-NODE_HEIGHT / 2 + 32})`);

    depBadge.append('rect')
      .attr('width', 72)
      .attr('height', 18)
      .attr('rx', 9)
      .attr('fill', d => {
        if (d.isBlocked) return '#fee2e2';
        if (d.dependentCount > 0) return '#f3e8ff';
        if (d.blockerCount > 0) return '#ecfdf5';
        return '#f8fafc';
      });

    depBadge.append('text')
      .attr('x', 36)
      .attr('y', 12.5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9.5px')
      .attr('font-weight', '700')
      .attr('fill', d => {
        if (d.isBlocked) return '#991b1b';
        if (d.dependentCount > 0) return '#6b21a8';
        if (d.blockerCount > 0) return '#065f46';
        return '#64748b';
      })
      .text(d => {
        if (d.isBlocked) return `⛔ Blocked (${d.unresolvedBlockerCount})`;
        if (d.dependentCount > 0) return `🔗 Blocks ${d.dependentCount}`;
        if (d.blockerCount > 0) return `✓ Ready`;
        return `• Solo`;
      });

    // Assignee Avatar / Initial on Bottom Left
    const footerGroup = nodeElements.append('g')
      .attr('transform', `translate(${-NODE_WIDTH / 2 + 16}, ${NODE_HEIGHT / 2 - 14})`);

    footerGroup.append('circle')
      .attr('r', 8)
      .attr('fill', '#4f46e5');

    footerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '3')
      .attr('font-size', '8.5px')
      .attr('font-weight', '700')
      .attr('fill', '#ffffff')
      .text(d => (d.assignee ? d.assignee.displayName.slice(0, 2).toUpperCase() : '?'));

    footerGroup.append('text')
      .attr('x', 14)
      .attr('dy', '3')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(d => (d.assignee ? d.assignee.displayName : 'Unassigned'));

    // Simulation tick - update node and link positions with curved cubic bezier paths
    simulation.on('tick', () => {
      linkElements.attr('d', (d: any) => {
        const source = d.source as GraphNode;
        const target = d.target as GraphNode;

        if (layoutMode === 'hierarchical') {
          // Source exit point (right middle of source card)
          const sx = source.x + NODE_WIDTH / 2;
          const sy = source.y;
          // Target entry point (left middle of target card)
          const tx = target.x - NODE_WIDTH / 2;
          const ty = target.y;

          const dx = tx - sx;
          const curvature = 0.5;
          const hx1 = sx + dx * curvature;
          const hy1 = sy;
          const hx2 = tx - dx * curvature;
          const hy2 = ty;

          return `M ${sx} ${sy} C ${hx1} ${hy1} ${hx2} ${hy2} ${tx} ${ty}`;
        } else {
          // Force or Radial straight or soft curved link
          const sx = source.x;
          const sy = source.y;
          const tx = target.x;
          const ty = target.y;
          return `M ${sx} ${sy} L ${tx} ${ty}`;
        }
      });

      nodeElements.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    // Fit to view on initial mount
    const timer = setTimeout(() => {
      handleResetZoom();
    }, 150);

    return () => {
      clearTimeout(timer);
      simulation.stop();
    };
  }, [nodes, links, layoutMode, filteredNodeIds, highlightedIds, selectedTaskId, onTaskClick, handleResetZoom, containerDimensions]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative select-none">
      {/* Top Controls Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-3 z-10 shadow-sm">
        {/* Left: Title & Quick Stats */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-900 font-bold text-sm">
            <NetworkIcon className="w-5 h-5 text-blue-600" />
            <span>Dependency Graph</span>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
              {stats.totalTasks} Tasks
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
              {stats.totalLinks} Links
            </span>
            {stats.blockedTasks > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold flex items-center space-x-1">
                <LockClosedIcon className="w-3 h-3" />
                <span>{stats.blockedTasks} Blocked</span>
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              {stats.completedTasks} Done
            </span>
          </div>
        </div>

        {/* Center: Search & Filter */}
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks in graph..."
              className="w-full text-xs pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Tasks</option>
            <option value="blocked">⛔ Blocked Only</option>
            <option value="ready">⚡ Ready to Work</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Completed</option>
          </select>
        </div>

        {/* Right: Layout Switcher & Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Layout Mode Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-medium border border-gray-200">
            <button
              onClick={() => setLayoutMode('hierarchical')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                layoutMode === 'hierarchical'
                  ? 'bg-white text-blue-600 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Left-to-right DAG Workflow"
            >
              Workflow (DAG)
            </button>
            <button
              onClick={() => setLayoutMode('force')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                layoutMode === 'force'
                  ? 'bg-white text-blue-600 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Organic Force-Directed"
            >
              Organic
            </button>
            <button
              onClick={() => setLayoutMode('radial')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                layoutMode === 'radial'
                  ? 'bg-white text-blue-600 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Radial Clustering"
            >
              Radial
            </button>
          </div>

          {/* Add Dependency Button */}
          <button
            onClick={() => setShowAddLinkModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Dependency</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-slate-50/50">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ minHeight: '450px' }}
          onClick={() => setSelectedTaskId(null)}
        />

        {/* Floating Zoom & Canvas Controls */}
        <div className="absolute bottom-5 right-5 flex flex-col bg-white rounded-xl shadow-md border border-gray-200 p-1 space-y-1 z-20">
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomInIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOutIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Fit to Screen"
          >
            <RefreshCwIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Graph Legend Banner */}
        <div className="absolute bottom-5 left-5 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 px-3.5 py-2 text-[11px] text-gray-600 flex items-center gap-4 z-10 hidden sm:flex">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-red-500 rounded" />
            <span>Active Blocker ──▶</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 border-dashed rounded" />
            <span>Completed Blocker ──▶</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-500" />
            <span>Blocked Task</span>
          </div>
          <div className="text-gray-400">
            Tip: Double-click any node to open task details
          </div>
        </div>

        {/* Selected Task Inspector Side Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-5 z-30 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${
                  selectedNode.status === 'Done' ? 'bg-emerald-500' :
                  selectedNode.isBlocked ? 'bg-red-500' :
                  selectedNode.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-400'
                }`} />
                <h3 className="font-bold text-gray-900 text-sm truncate max-w-[190px]">
                  {selectedNode.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-3 text-xs">
              {/* Status & Priority */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status:</span>
                <span className={`px-2 py-0.5 rounded font-semibold ${
                  selectedNode.status === 'Done' ? 'bg-emerald-100 text-emerald-800' :
                  selectedNode.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedNode.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Priority:</span>
                <span className="font-semibold capitalize text-gray-800">
                  {selectedNode.priority}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Assignee:</span>
                <span className="font-medium text-gray-800">
                  {selectedNode.assignee ? selectedNode.assignee.displayName : 'Unassigned'}
                </span>
              </div>

              {/* Blockers list */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-gray-700 flex items-center space-x-1">
                    <LockClosedIcon className="w-3.5 h-3.5 text-red-500" />
                    <span>Blocked By ({selectedNode.blockerCount})</span>
                  </span>
                </div>
                {selectedNode.blockerCount > 0 ? (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {(selectedNode.task.blockedBy || selectedNode.task.dependencies || []).map(bId => {
                      const blocker = tasks.find(t => t.id === bId);
                      if (!blocker) return null;
                      return (
                        <div key={bId} className="flex items-center justify-between bg-gray-50 p-1.5 rounded text-[11px]">
                          <span className={`truncate max-w-[140px] ${blocker.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {blocker.title}
                          </span>
                          <div className="flex items-center space-x-1">
                            <span className={`px-1 rounded text-[9px] ${blocker.status === 'Done' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                              {blocker.status}
                            </span>
                            <button
                              onClick={() => handleRemoveDependency(bId, selectedNode.id)}
                              className="text-gray-400 hover:text-red-600 p-0.5"
                              title="Unlink dependency"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-[11px]">No prerequisite blocker tasks.</p>
                )}
              </div>

              {/* Downstream Dependents list */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-gray-700 flex items-center space-x-1">
                    <LinkIcon className="w-3.5 h-3.5 text-purple-500" />
                    <span>Blocks ({selectedNode.dependentCount})</span>
                  </span>
                </div>
                {selectedNode.dependentCount > 0 ? (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {(selectedNode.task.blocking || []).map(depId => {
                      const dependent = tasks.find(t => t.id === depId);
                      if (!dependent) return null;
                      return (
                        <div key={depId} className="flex items-center justify-between bg-purple-50/50 p-1.5 rounded text-[11px]">
                          <span className="truncate max-w-[140px] text-gray-800">
                            {dependent.title}
                          </span>
                          <div className="flex items-center space-x-1">
                            <span className="px-1 rounded text-[9px] bg-purple-100 text-purple-700">
                              {dependent.status}
                            </span>
                            <button
                              onClick={() => handleRemoveDependency(selectedNode.id, depId)}
                              className="text-gray-400 hover:text-red-600 p-0.5"
                              title="Unlink dependency"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-[11px]">No downstream tasks waiting.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
              {onTaskClick && (
                <button
                  onClick={() => onTaskClick(selectedNode.task)}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold text-center transition-colors"
                >
                  Open Task Details
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Dependency Modal */}
      {showAddLinkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <NetworkIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-base">Connect Task Dependency</h3>
              </div>
              <button
                onClick={() => setShowAddLinkModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Establish a directed dependency relationship between two tasks in <strong>{project.name}</strong>.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  1. Prerequisite Blocker Task (Must finish first):
                </label>
                <select
                  value={newSourceId}
                  onChange={e => setNewSourceId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select prerequisite task...</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id} disabled={t.id === newTargetId}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-center py-1">
                <ArrowRightIcon className="w-5 h-5 text-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  2. Downstream Blocked Task (Waits on prerequisite):
                </label>
                <select
                  value={newTargetId}
                  onChange={e => setNewTargetId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select dependent task...</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id} disabled={t.id === newSourceId}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowAddLinkModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDependency}
                disabled={!newSourceId || !newTargetId || newSourceId === newTargetId}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
              >
                Connect Dependency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DependencyGraph;
