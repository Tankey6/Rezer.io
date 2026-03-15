import { Vector } from '../Vector.ts';
import { EntityType } from '../types.ts';

let nextEntityId = 1;

export abstract class Entity {
  id: number = nextEntityId++;
  pos: Vector;
  renderPos: Vector;
  angle: number = 0;
  vel: Vector = new Vector(0, 0);
  stateBuffer: { pos: Vector, angle: number, timestamp: number }[] = [];
  radius: number;
  color: string;
  type: EntityType;
  health: number;
  maxHealth: number;
  dead: boolean = false;
  visibility: number = 1; // 0 to 1
  isInvisible: boolean = false;
  lastDamagedBy: number | null = null;

  constructor(pos: Vector, radius: number, color: string, type: EntityType, health: number) {
    this.pos = pos;
    this.renderPos = pos.copy();
    this.radius = radius;
    this.color = color;
    this.type = type;
    this.health = health;
    this.maxHealth = health;
  }

  interpolate(serverTime: number) {
    if (this.stateBuffer.length < 2) {
      this.renderPos = this.pos.copy();
      return;
    }

    // Find the two states to interpolate between
    let i = 0;
    for (; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i + 1].timestamp > serverTime) break;
    }

    if (i >= this.stateBuffer.length - 1) {
      this.renderPos = this.stateBuffer[this.stateBuffer.length - 1].pos.copy();
      return;
    }

    const s0 = this.stateBuffer[i];
    const s1 = this.stateBuffer[i + 1];
    const t = (serverTime - s0.timestamp) / (s1.timestamp - s0.timestamp);
    
    const targetPos = new Vector(
      s0.pos.x + (s1.pos.x - s0.pos.x) * t,
      s0.pos.y + (s1.pos.y - s0.pos.y) * t
    );
    
    // Hitbox-Biased Smoothing
    const dist = this.renderPos.dist(targetPos);
    const bias = Math.min(1, dist / Math.max(1, this.radius * 0.5));
    this.renderPos = this.renderPos.lerp(targetPos, Math.max(0.2, bias));
    
    // Interpolate angle
    let angleDiff = s1.angle - s0.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle = s0.angle + angleDiff * t;
  }

  update(dt: number) {
    this.pos = this.pos.add(this.vel.mult(dt));
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;

  takeDamage(amount: number, damagerId: number | null = null) {
    this.health -= amount;
    if (damagerId !== null) this.lastDamagedBy = damagerId;
    if (this.health <= 0) {
      this.dead = true;
    }
  }
}
