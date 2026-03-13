import { Entity } from './Entity.ts';
import { Vector } from '../Vector.ts';
import { EntityType } from '../types.ts';
import { darkenColor } from '../utils.ts';

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
  }
}
