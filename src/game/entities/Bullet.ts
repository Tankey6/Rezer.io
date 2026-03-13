import { Entity } from './Entity.ts';
import { Vector } from '../Vector.ts';
import { EntityType } from '../types.ts';
import { darkenColor } from '../utils.ts';

export class Bullet extends Entity {
  ownerId: number;
  damage: number;
  lifeTime: number = 3;
  age: number = 0;
  penetration: number;
  isDamaging: boolean = false;
  isRailgun: boolean = false;
  deadTimer: number = 0;
  trail: { pos: Vector, timestamp: number }[] = [];

  constructor(pos: Vector, vel: Vector, ownerId: number, damage: number, penetration: number, radius: number = 8, color: string = '#00b2e1', isRailgun: boolean = false) {
    super(pos, radius, color, EntityType.BULLET, 1);
    this.vel = vel;
    this.ownerId = ownerId;
    this.damage = damage;
    this.penetration = penetration;
    this.isRailgun = isRailgun;
  }

  update(dt: number) {
    if (this.dead) {
      if (this.isRailgun) {
        this.deadTimer += dt;
      }
      return;
    }
    
    super.update(dt);
    this.age += dt;
    
    if (!this.isRailgun && this.isDamaging) {
      // Decay bullet speed by 0.3x per second if in a polygon/tank (assuming 60fps)
      this.vel = this.vel.mult(Math.pow(0.1, dt));
    } else if (!this.isRailgun) {
      // Decay bullet speed by 0.6x per second otherwise if not a Railgun.
      this.vel = this.vel.mult(Math.pow(0.6, dt));
    }
    
    if (this.isDamaging) {
      this.penetration -= 1.0 * dt;
    } else {
      this.penetration -= 0.1 * dt;
    }
    
    if (this.penetration <= 0 || this.age >= this.lifeTime) {
      this.dead = true;
    }
    
    this.isDamaging = false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.isRailgun) {
      const now = performance.now();
      if (!this.dead) {
        // Add current position to trail
        this.trail.push({ pos: this.renderPos.copy(), timestamp: now });
      }
      
      // Remove old ones (older than 1000ms)
      while (this.trail.length > 0 && now - this.trail[0].timestamp > 1000) {
        this.trail.shift();
      }
      
      if (this.trail.length > 0) {
        for (let i = 0; i < this.trail.length; i++) {
          const t = this.trail[i];
          const age = now - t.timestamp;
          const alpha = Math.max(0, 1.0 * (1 - age / 1000));
          
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(t.pos.x, t.pos.y, this.radius, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
          ctx.strokeStyle = darkenColor(this.color);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }
    }

    if (!this.dead) {
      ctx.beginPath();
      ctx.arc(this.renderPos.x, this.renderPos.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = darkenColor(this.color);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
