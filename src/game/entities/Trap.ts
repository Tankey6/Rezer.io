import { Entity } from './Entity';
import { Vector } from '../Vector';
import { EntityType } from '../types';
import { darkenColor } from '../utils';

export class Trap extends Entity {
  ownerId: number;
  damage: number;
  lifeTime: number = 15;
  age: number = 0;
  penetration: number;
  isDamaging: boolean = false;
  angle: number = 0;
  spinSpeed: number = 0;

  constructor(pos: Vector, vel: Vector, ownerId: number, color: string, damage: number, penetration: number, radius: number = 12) {
    super(pos, radius, color, EntityType.TRAP, 1);
    this.vel = vel;
    this.ownerId = ownerId;
    this.damage = damage;
    this.penetration = penetration;
    this.angle = Math.random() * Math.PI * 2;
    this.spinSpeed = (Math.random() - 0.5) * Math.PI * 2; // Random spin speed
  }

  update(dt: number) {
    super.update(dt);
    this.age += dt;
    this.vel = this.vel.mult(0.92); // High friction
    this.angle += this.spinSpeed * dt;
    
    if (this.isDamaging) {
      this.penetration -= 1.0 * dt;
    } else {
      this.penetration -= 0.05 * dt;
    }
    
    if (this.penetration <= 0 || this.age >= this.lifeTime) {
      this.dead = true;
    }
    
    this.isDamaging = false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.renderPos.x, this.renderPos.y);
    ctx.rotate(this.angle);
    
    ctx.beginPath();
    // Draw 4-pointed star
    const numPoints = 8;
    for (let i = 0; i < numPoints; i++) {
      const a = (i * Math.PI * 2) / numPoints;
      const r = i % 2 === 0 ? this.radius : this.radius * 0.5;
      if (i === 0) {
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      } else {
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    ctx.closePath();
    
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = darkenColor(this.color);
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.restore();
  }
}
