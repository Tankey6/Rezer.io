import React, { useEffect, useRef } from 'react';
import { TankClass } from '../game/types.ts';
import { TANK_CLASSES } from '../game/tankClasses.ts';
import { darkenColor } from '../game/utils.ts';

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
      const isSquareBody = tankClass === TankClass.Underseer || 
                           tankClass === TankClass.AutoUnderseer ||
                           tankClass === TankClass.Necromancer ||
                           tankClass === TankClass.GreyGoo ||
                           tankClass === TankClass.Lich ||
                           tankClass === TankClass.Pythonist;
      const isHexagonBody = tankClass === TankClass.Smasher ||
                            tankClass === TankClass.AutoSmasher ||
                            tankClass === TankClass.Landmine ||
                            tankClass === TankClass.Spike;
      ctx.beginPath();
      if (isSquareBody) {
        ctx.moveTo(-20, -20);
        ctx.lineTo(20, -20);
        ctx.lineTo(20, 20);
        ctx.lineTo(-20, 20);
        ctx.closePath();
      } else if (isHexagonBody) {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = Math.cos(angle) * 23; // 20 * 1.15
          const y = Math.sin(angle) * 23;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
      }
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
          
          if (barrel.drawBase) {
            ctx.beginPath();
            if (barrel.baseType === 'triangle') {
              ctx.moveTo(0, -barrel.width);
              ctx.lineTo(barrel.length * 0.5, 0);
              ctx.lineTo(0, barrel.width);
              ctx.closePath();
            } else if (barrel.baseType === 'square') {
              ctx.rect(-barrel.width / 2, -barrel.width / 2, barrel.width, barrel.width);
              ctx.fillStyle = '#999999'; // Grey square
            } else {
              ctx.arc(0, 0, barrel.baseRadius || (barrel.width * 0.75), 0, Math.PI * 2);
              ctx.fillStyle = barrelColor;
            }
            ctx.fill();
            ctx.stroke();
          }
          
        } else {
          ctx.translate(barrel.xOffset, barrel.yOffset);
          ctx.rotate(barrel.angleOffset);
          
          ctx.fillStyle = barrelColor;
          ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
          ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
          
          if (barrel.drawBase) {
            ctx.beginPath();
            if (barrel.baseType === 'triangle') {
              ctx.moveTo(0, -barrel.width);
              ctx.lineTo(barrel.length * 0.5, 0);
              ctx.lineTo(0, barrel.width);
              ctx.closePath();
            } else if (barrel.baseType === 'square') {
              ctx.rect(-barrel.width / 2, -barrel.width / 2, barrel.width, barrel.width);
              ctx.fillStyle = '#999999'; // Grey square
            } else {
              ctx.arc(0, 0, barrel.baseRadius || (barrel.width * 0.75), 0, Math.PI * 2);
              ctx.fillStyle = barrelColor;
            }
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
