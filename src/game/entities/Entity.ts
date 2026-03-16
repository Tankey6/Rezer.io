import { Vector } from '../Vector.ts';
import { EntityType } from '../types.ts';

export abstract class Entity {
  static nextEntityId = 1;
  id: number = Entity.nextEntityId++;
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

  damageMap: Map<number, number> = new Map();

  constructor(pos: Vector, radius: number, color: string, type: EntityType, health: number) {
    this.pos = pos;
    this.renderPos = pos.copy();
    this.radius = radius;
    this.color = color;
    this.type = type;
    this.health = health;
    this.maxHealth = health;
  }

  teleport(pos: Vector) {
    this.pos = pos.copy();
    this.renderPos = pos.copy();
    this.stateBuffer = [];
  }

  interpolate(serverTime: number) {
    if (this.stateBuffer.length < 2) {
      this.renderPos = this.pos.copy();
      this.visibility = 0; // Hide until we have enough states to interpolate smoothly
      return;
    }

    // Find the two states to interpolate between
    let i = 0;
    for (; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i + 1].timestamp > serverTime) break;
    }

    if (i >= this.stateBuffer.length - 1) {
      const target = this.stateBuffer[this.stateBuffer.length - 1].pos;
      if (this.renderPos.distSq(target) > 500 * 500) {
        this.renderPos = target.copy();
        this.visibility = 0;
      } else {
        this.renderPos = this.renderPos.lerp(target, 0.8);
        this.visibility = 1;
      }
      return;
    }

    const s0 = this.stateBuffer[i];
    const s1 = this.stateBuffer[i + 1];
    const dt = s1.timestamp - s0.timestamp;
    if (dt === 0) {
      this.renderPos = s1.pos.copy();
      return;
    }
    const t = (serverTime - s0.timestamp) / dt;

    // Hermite interpolation
    // Tangents
    const getTangent = (idx: number) => {
      if (idx <= 0) return s1.pos.sub(s0.pos); // Velocity * dt
      if (idx >= this.stateBuffer.length - 1) return s1.pos.sub(s0.pos);
      const prev = this.stateBuffer[idx - 1];
      const next = this.stateBuffer[idx + 1];
      const dt_neighbor = next.timestamp - prev.timestamp;
      if (dt_neighbor === 0) return new Vector(0, 0);
      const vel = next.pos.sub(prev.pos).div(dt_neighbor);
      return vel.mult(dt);
    };

    const m0 = getTangent(i);
    const m1 = getTangent(i + 1);

    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const targetPos = s0.pos.mult(h00).add(m0.mult(h10)).add(s1.pos.mult(h01)).add(m1.mult(h11));

    // Interpolate angle
    let angleDiff = s1.angle - s0.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle = s0.angle + angleDiff * t;
    
    // Snap if distance is too large (teleport detection)
    if (this.renderPos.distSq(targetPos) > 500 * 500) {
      this.renderPos = targetPos.copy();
      this.visibility = 0;
    } else {
      this.renderPos = this.renderPos.lerp(targetPos, 0.8);
      this.visibility = 1;
    }
  }

  update(dt: number) {
    this.pos = this.pos.add(this.vel.mult(dt));
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;

  takeDamage(amount: number, damagerId: number | null = null) {
    if (this.dead || this.health <= 0) return;
    
    const actualDamage = Math.max(0, Math.min(amount, this.health));
    if (damagerId !== null && actualDamage > 0) {
      this.lastDamagedBy = damagerId;
      const current = this.damageMap.get(damagerId) || 0;
      this.damageMap.set(damagerId, current + actualDamage);
    }
    
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
    }
  }
}
