import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TankClass } from '../game/types.ts';
import { UPGRADE_PATHS } from '../game/tankClasses.ts';
import { TankPreview } from './TankPreview.ts';

interface UpgradeTreeProps {
  onClose: () => void;
}

export const UpgradeTree: React.FC<UpgradeTreeProps> = ({ onClose }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Compute tree layout
  const { nodes, edges } = useMemo(() => {
    const nodeList: { id: string, tank: TankClass | 'dummy', x: number, y: number }[] = [];
    const edgeList: { fromId: string, toId: string }[] = [];
    
    const X_SPACING = 400;
    const Y_SPACING = 320;
    
    let nextId = 0;
    const createNode = (tank: TankClass | 'dummy', x: number, y: number, parentId?: string) => {
      const id = `node-${nextId++}`;
      const node = { id, tank, x, y };
      nodeList.push(node);
      if (parentId) {
        edgeList.push({ fromId: parentId, toId: id });
      }
      return node;
    };

    // Helper to get tier based on level requirements
    const getRequiredLevel = (tank: TankClass | 'dummy') => {
      if (tank === 'dummy') return 30;
      const tier1 = [TankClass.Twin, TankClass.Sniper, TankClass.MachineGun, TankClass.FlankGuard, TankClass.Director, TankClass.Trapper, TankClass.Pounder];
      const tier2 = [
        TankClass.TripleShot, TankClass.QuadTank, TankClass.TwinFlank, TankClass.Wark,
        TankClass.Assassin, TankClass.Hunter,
        TankClass.Gunner, TankClass.MachineTrapper, TankClass.GatlingGun,
        TankClass.Destroyer, TankClass.MegaTrapper, TankClass.Composition,
        TankClass.TriAngle, TankClass.Auto3, TankClass.TriTrapper, TankClass.TrapGuard,
        TankClass.Overseer, TankClass.Cruiser, TankClass.Manager,
        TankClass.Howitzer
      ];
      if (tank === TankClass.Basic) return 0;
      if (tier1.includes(tank)) return 15;
      if (tier2.includes(tank)) return 30;
      return 45;
    };

    const tiers: Record<string, number> = {};
    Object.values(TankClass).forEach(tank => {
      const lvl = getRequiredLevel(tank as TankClass);
      if (lvl === 0) tiers[tank] = 0;
      else if (lvl === 15) tiers[tank] = 1;
      else if (lvl === 30) tiers[tank] = 2;
      else tiers[tank] = 3;
    });

    const getBranchHeight = (tank: TankClass) => {
      const upgrades = UPGRADE_PATHS[tank] || [];
      const t2Tanks = upgrades.filter(t => tiers[t] === 2);
      const t3Tanks = upgrades.filter(t => tiers[t] === 3);
      const totalCount = t2Tanks.length + t3Tanks.length;
      if (totalCount === 0) return Y_SPACING;
      return totalCount * Y_SPACING;
    };

    // Root
    const root = createNode(TankClass.Basic, 0, 0);

    // Tier 1
    const t1Tanks = (UPGRADE_PATHS[TankClass.Basic] || []).filter(t => tiers[t] === 1);
    
    let currentY = 0;
    const t1RelPositions: number[] = [];
    t1Tanks.forEach(tank => {
      const h = getBranchHeight(tank);
      t1RelPositions.push(currentY + h / 2);
      currentY += h + Y_SPACING * 0.2;
    });
    
    const totalT1Height = currentY - Y_SPACING * 0.2;
    const startY = -totalT1Height / 2;

    t1Tanks.forEach((t1Tank, i) => {
      const y = startY + t1RelPositions[i];
      const t1Node = createNode(t1Tank, X_SPACING, y, root.id);

      // Tier 2 and Tier 3 jumps
      const upgrades = UPGRADE_PATHS[t1Tank] || [];
      const t2Tanks = upgrades.filter(t => tiers[t] === 2);
      const t3Tanks = upgrades.filter(t => tiers[t] === 3);
      
      const totalChildren = t2Tanks.length + t3Tanks.length;
      const childrenHeight = (totalChildren - 1) * Y_SPACING;
      const childrenStartY = y - childrenHeight / 2;

      // Handle Tier 2 tanks
      t2Tanks.forEach((t2Tank, j) => {
        const t2Y = childrenStartY + j * Y_SPACING;
        const t2Node = createNode(t2Tank, X_SPACING * 2.2, t2Y, t1Node.id);

        // Tier 3 - Horizontal to the right
        const t3TanksOfT2 = (UPGRADE_PATHS[t2Tank] || []).filter(t => tiers[t] === 3);
        t3TanksOfT2.forEach((t3Tank, k) => {
          const t3X = X_SPACING * 2.2 + 450 + k * (X_SPACING * 0.8);
          createNode(t3Tank, t3X, t2Y, t2Node.id);
        });
      });

      // Handle Tier 3 jumps (Level 15 -> Level 45)
      t3Tanks.forEach((t3Tank, j) => {
        const dummyY = childrenStartY + (t2Tanks.length + j) * Y_SPACING;
        const dummyNode = createNode('dummy', X_SPACING * 2.2, dummyY, t1Node.id);
        
        const t3X = X_SPACING * 2.2 + 450;
        createNode(t3Tank, t3X, dummyY, dummyNode.id);
      });
    });

    return { nodes: nodeList, edges: edgeList };
  }, []);

  // Center the tree initially
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setTransform(prev => ({
        ...prev,
        x: clientWidth / 2 - 400 * 0.5,
        y: clientHeight / 2,
        scale: 0.25
      }));
    }
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.05, transform.scale * (1 + scaleAmount)), 3);
    
    // Zoom towards mouse cursor
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const dx = (mouseX - transform.x) * (newScale / transform.scale - 1);
      const dy = (mouseY - transform.y) * (newScale / transform.scale - 1);
      
      setTransform({
        x: transform.x - dx,
        y: transform.y - dy,
        scale: newScale
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 text-white text-xl font-bold z-50 bg-black/50 px-4 py-2 rounded">
        Press T or Click here to close
      </div>
      <div className="absolute top-4 left-4 text-white text-xl font-bold z-50 bg-black/50 px-4 py-2 rounded flex flex-col gap-2">
        <div>Scroll to zoom, Drag to pan</div>
        <input 
          type="text" 
          placeholder="Search tanks..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-white/20 text-white placeholder-white/50 px-3 py-1 rounded outline-none border border-white/30 focus:border-white"
        />
      </div>
      
      <div 
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: 0,
            height: 0
          }}
        >
          {/* Draw edges */}
          <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0 }}>
            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.fromId);
              const toNode = nodes.find(n => n.id === edge.toId);
              if (!fromNode || !toNode) return null;
              
              const isHighlighted = searchQuery && (
                (fromNode.tank !== 'dummy' && fromNode.tank.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (toNode.tank !== 'dummy' && toNode.tank.toLowerCase().includes(searchQuery.toLowerCase()))
              );
              const isDimmed = searchQuery && !isHighlighted;

              return (
                <path
                  key={i}
                  d={`M ${fromNode.x + (fromNode.tank === 'dummy' ? 0 : 300)} ${fromNode.y} C ${fromNode.x + (fromNode.tank === 'dummy' ? 50 : 350)} ${fromNode.y}, ${toNode.x - 50} ${toNode.y}, ${toNode.x} ${toNode.y}`}
                  fill="none"
                  stroke={isHighlighted ? "#ffe869" : "#4b5563"}
                  strokeWidth={isHighlighted ? "12" : "8"}
                  opacity={isDimmed ? "0.15" : (isHighlighted ? "1" : "0.6")}
                  style={{ transition: 'all 0.3s ease' }}
                />
              );
            })}
          </svg>

          {/* Draw nodes */}
          {nodes.map((node) => {
            if (node.tank === 'dummy') return null;

            const isHighlighted = searchQuery && node.tank.toLowerCase().includes(searchQuery.toLowerCase());
            const isDimmed = searchQuery && !isHighlighted;
            
            return (
              <div
                key={node.id}
                className={`absolute bg-[#00b2e1] border-4 ${isHighlighted ? 'border-[#ffe869] shadow-[0_0_30px_rgba(255,232,105,0.8)]' : 'border-[#0089ad]'} text-white rounded-xl shadow-2xl flex flex-col items-center justify-center p-4 transition-all duration-300`}
                style={{
                  left: node.x,
                  top: node.y,
                  transform: `translate(0, -50%) ${isHighlighted ? 'scale(1.1)' : ''}`,
                  width: '300px',
                  height: '300px',
                  opacity: isDimmed ? 0.2 : 1,
                  zIndex: isHighlighted ? 10 : 1
                }}
              >
                <TankPreview tankClass={node.tank} size={175} />
                <span className="text-3xl font-bold mt-4 text-center truncate w-full">{node.tank}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
