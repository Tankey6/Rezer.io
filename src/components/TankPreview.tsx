import React, { useEffect, useRef } from 'react';
import { TankClass } from '../game/types';
import { TANK_CLASSES } from '../game/tankClasses';
import { darkenColor } from '../game/utils';

interface TankPreviewProps {
  tankClass: TankClass;
  size?: number;
}

export function TankPreview({ tankClass, size = 64 }: TankPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      
      ctx.save();
      ctx.translate(size / 2, size / 2);
      
      const barrels = TANK_CLASSES[tankClass] || [];

      // Calculate max radius to scale dynamically
      let maxRadius = 20; // base body radius
      for (const barrel of barrels) {
        const dist = (barrel.posDist || 0) + barrel.length + Math.abs(barrel.xOffset || 0);
        if (dist > maxRadius) maxRadius = dist;
      }
      maxRadius += 5; // margin

      const scale = (size / 2) / maxRadius;
      ctx.scale(scale, scale);
      
      ctx.rotate(angle);
      
      const color = '#00b2e1';
      const outlineColor = darkenColor(color);
      const barrelColor = '#999999';
      const barrelOutline = darkenColor(barrelColor);

      // Draw barrels
      ctx.fillStyle = barrelColor;
      ctx.strokeStyle = barrelOutline;
      ctx.lineWidth = 3;

      for (const barrel of barrels) {
        if (barrel.autoAim) continue;
        ctx.save();
        
        if (barrel.posDist !== undefined && barrel.posAngle !== undefined) {
          ctx.rotate(barrel.posAngle);
          ctx.translate(barrel.posDist, 0);
          ctx.rotate(barrel.angleOffset - barrel.posAngle);
        } else {
          ctx.rotate(barrel.angleOffset);
          ctx.translate(barrel.xOffset, barrel.yOffset);
        }
        
        if (barrel.widthEnd !== undefined) {
          ctx.beginPath();
          ctx.moveTo(0, -barrel.width / 2);
          ctx.lineTo(barrel.length, -barrel.widthEnd / 2);
          ctx.lineTo(barrel.length, barrel.widthEnd / 2);
          ctx.lineTo(0, barrel.width / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
          ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
        }
        
        ctx.restore();
      }

      // Draw body
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Draw auto turrets
      ctx.strokeStyle = barrelOutline;
      for (const barrel of barrels) {
        if (!barrel.autoAim) continue;
        
        ctx.save();
        
        if (barrel.posDist !== undefined && barrel.posAngle !== undefined) {
          ctx.rotate(barrel.posAngle);
          ctx.translate(barrel.posDist, 0);
          
          ctx.save();
          ctx.rotate(barrel.angleOffset - barrel.posAngle);
          ctx.translate(barrel.xOffset || 0, barrel.yOffset || 0);
          
          ctx.fillStyle = barrelColor;
          ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
          ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
          ctx.restore();
          
          if (barrel.drawBase !== false) {
            ctx.beginPath();
            ctx.arc(0, 0, barrel.baseRadius || (barrel.width * 0.75), 0, Math.PI * 2);
            ctx.fillStyle = barrelColor;
            ctx.fill();
            ctx.stroke();
          }
          
        } else {
          ctx.translate(barrel.xOffset, barrel.yOffset);
          ctx.rotate(barrel.angleOffset);
          
          ctx.fillStyle = barrelColor;
          ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
          ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
          
          if (barrel.drawBase !== false) {
            ctx.beginPath();
            ctx.arc(0, 0, barrel.baseRadius || (barrel.width * 0.75), 0, Math.PI * 2);
            ctx.fillStyle = barrelColor;
            ctx.fill();
            ctx.stroke();
          }
        }
        
        ctx.restore();
      }

      ctx.restore();

      angle += 0.02;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [tankClass, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block"
    />
  );
}
