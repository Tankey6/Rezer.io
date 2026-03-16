import { Entity } from './Entity.ts';
import { Vector } from '../Vector.ts';
import { EntityType, CrasherType } from '../types.ts';
import { darkenColor } from '../utils.ts';

export class Crasher extends Entity {
  angle: number = Math.random() * Math.PI * 2;
  damage: number = 80;
  speed: number = 180;
  target: Entity | null = null;
  crasherType: CrasherType;

  constructor(pos: Vector, crasherType: CrasherType = CrasherType.SMALL) {
    let radius = 12;
    let health = 120;
    let color = '#f177dd';
    let speed = 180;
    let damage = 40;

    if (crasherType === CrasherType.MEDIUM) {
      radius = 20;
      health = 300;
      speed = 150;
      damage = 60;
    } else if (crasherType === CrasherType.LARGE) {
      radius = 35;
      health = 600;
      speed = 120;
      damage = 100;
    } else if (crasherType === CrasherType.LIGHTNING) {
      radius = 15;
      health = 250;
      color = '#fcf771'
      speed = 250;
      damage = 80;
    }

    super(pos, radius, color, EntityType.CRASHER, health);
    this.crasherType = crasherType;
    this.speed = speed;
    this.damage = damage;
    this.vel = new Vector((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
  }

  tick(dt: number, entities: Entity[]) {
    // AI: Find nearest target (Player or Drone)
    if (!this.target || this.target.dead) {
      let minDist = 800;
      this.target = null;
      for (const e of entities) {
        if (e.type === EntityType.PLAYER || e.type === EntityType.DRONE) {
          const dist = this.pos.dist(e.pos);
          if (dist < minDist) {
            minDist = dist;
            this.target = e;
          }
        }
      }
    }

    if (this.target) {
      const dir = this.target.pos.sub(this.pos).normalize();
      this.vel = this.vel.add(dir.mult(this.speed * 2 * dt)).limit(this.speed);
      this.angle = Math.atan2(this.vel.y, this.vel.x);
    } else {
      this.vel = this.vel.mult(0.98); // Friction if no target
    }

    super.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.visibility <= 0) return;
    ctx.save();
    ctx.translate(this.renderPos.x, this.renderPos.y);
    ctx.rotate(this.angle);

    ctx.beginPath();
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.8, -this.radius * 0.8);
    ctx.closePath();

    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = darkenColor(this.color);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
    
    if (this.health < this.maxHealth) {
      ctx.fillStyle = '#555555';
      ctx.fillRect(this.renderPos.x - 10, this.renderPos.y + this.radius + 5, 20, 3);
      ctx.fillStyle = '#86c680';
      ctx.fillRect(this.renderPos.x - 10, this.renderPos.y + this.radius + 5, 20 * Math.max(0, this.health / this.maxHealth), 3);
    }
  }
}
