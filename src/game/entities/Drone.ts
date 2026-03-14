import { Entity } from './Entity.ts';
import { Vector } from '../Vector.ts';
import { EntityType, MissileType, BarrelDef } from '../types.ts';
import { darkenColor } from '../utils.ts';
import { getMissileBarrels, AUTO_TURRET_BARREL } from '../tankClasses.ts';

export class Drone extends Entity {
  ownerId: number;
  damage: number;
  penetration: number;
  isDamaging: boolean = false;
  angle: number = 0;
  targetPos: Vector | null = null;
  speed: number;
  isCruiser: boolean;
  age: number = 0;
  lifeTime: number = 30;
  
  hasAutoTurret: boolean = false;
  missileType: MissileType = MissileType.None;
  autoAngle: number = 0;
  reloadTimers: number[] = [];

  constructor(pos: Vector, vel: Vector, ownerId: number, color: string, damage: number, penetration: number, radius: number = 10, speed: number = 300, isCruiser: boolean = false) {
    super(pos, radius, color, EntityType.DRONE, 1);
    this.vel = vel;
    this.ownerId = ownerId;
    this.damage = damage;
    this.penetration = penetration;
    this.speed = speed;
    this.isCruiser = isCruiser;
    this.angle = Math.atan2(vel.y, vel.x);
    if (this.isCruiser) {
      this.lifeTime = 10;
    }
  }

  update(dt: number) {
    super.update(dt);
    this.age += dt;
    
    if (this.targetPos) {
      const dir = this.targetPos.sub(this.pos).normalize();
      this.vel = this.vel.add(dir.mult(this.speed * 5 * dt));
    }
    
    this.vel = this.vel.mult(0.95); // Friction
    
    if (this.vel.mag() > 10) {
      this.angle = Math.atan2(this.vel.y, this.vel.x);
    }
    
    if (this.isDamaging) {
      this.penetration -= 1.0 * dt;
    }
    
    if (this.penetration <= 0 || this.age >= this.lifeTime) {
      this.dead = true;
    }
    
    this.isDamaging = false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.renderPos.x, this.renderPos.y);
    
    let barrels: BarrelDef[] = [];
    if (this.missileType !== MissileType.None) {
      barrels = barrels.concat(getMissileBarrels(this.missileType));
    }
    if (this.hasAutoTurret) {
      barrels.push(AUTO_TURRET_BARREL);
    }

    // Draw normal barrels
    ctx.fillStyle = '#999999';
    ctx.strokeStyle = '#727272';
    ctx.lineWidth = 2;
    
    for (const barrel of barrels) {
      if (barrel.autoAim) continue;
      
      ctx.save();
      ctx.rotate(this.angle + barrel.angleOffset);
      ctx.translate(barrel.xOffset, barrel.yOffset);
      
      if (barrel.widthEnd !== undefined && barrel.length > 0) {
        ctx.beginPath();
        ctx.moveTo(0, -barrel.width / 2);
        ctx.lineTo(barrel.length, -barrel.widthEnd / 2);
        ctx.lineTo(barrel.length, barrel.widthEnd / 2);
        ctx.lineTo(0, barrel.width / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (barrel.length > 0) {
        ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
        ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
      }
      
      if (barrel.drawBase) {
        this.drawBarrelBase(ctx, barrel);
      }
      
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(this.angle);
    
    ctx.beginPath();
    // Draw drone shape (triangle)
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(-this.radius * 0.5, this.radius * 0.866);
    ctx.lineTo(-this.radius * 0.5, -this.radius * 0.866);
    ctx.closePath();
    
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = darkenColor(this.color);
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.restore();

    // Draw auto turrets
    ctx.strokeStyle = '#727272';
    for (const barrel of barrels) {
      if (!barrel.autoAim && !(barrel.visualOnly && barrel.baseType === 'square')) continue;
      
      ctx.save();
      
      // Draw turret base (before rotation if it's a square at 0,0)
      if (barrel.drawBase && barrel.baseType === 'square' && (barrel.xOffset || 0) === 0 && (barrel.yOffset || 0) === 0) {
        this.drawBarrelBase(ctx, barrel);
      }

      ctx.save();
      ctx.rotate(this.autoAngle + barrel.angleOffset);
      ctx.translate(barrel.xOffset, barrel.yOffset);
      
      if (barrel.widthEnd !== undefined && barrel.length > 0) {
        ctx.beginPath();
        ctx.moveTo(0, -barrel.width / 2);
        ctx.lineTo(barrel.length, -barrel.widthEnd / 2);
        ctx.lineTo(barrel.length, barrel.widthEnd / 2);
        ctx.lineTo(0, barrel.width / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (barrel.length > 0) {
        ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
        ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
      }
      ctx.restore();
      
      // Draw auto turret base (after rotation if it's not a square at 0,0)
      if (barrel.drawBase && !(barrel.baseType === 'square' && (barrel.xOffset || 0) === 0 && (barrel.yOffset || 0) === 0)) {
        this.drawBarrelBase(ctx, barrel);
      }
      
      ctx.restore();
    }

    ctx.restore();
  }

  drawBarrelBase(ctx: CanvasRenderingContext2D, barrel: BarrelDef) {
    ctx.save();
    ctx.beginPath();
    if (barrel.baseType === 'triangle') {
      ctx.moveTo(0, -barrel.width);
      ctx.lineTo(barrel.length * 0.5, 0);
      ctx.lineTo(0, barrel.width);
      ctx.closePath();
    } else if (barrel.baseType === 'square') {
      ctx.rect(-barrel.width / 2, -barrel.width / 2, barrel.width, barrel.width);
    } else {
      ctx.arc(0, 0, barrel.baseRadius || (barrel.width * 0.75), 0, Math.PI * 2);
    }
    ctx.fillStyle = '#999999';
    ctx.fill();
    ctx.strokeStyle = '#727272';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}
