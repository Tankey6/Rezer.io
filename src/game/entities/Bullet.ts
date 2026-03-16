import { Entity } from './Entity.ts';
import { Vector } from '../Vector.ts';
import { EntityType, MissileType, BarrelDef, TankClass } from '../types.ts';
import { darkenColor } from '../utils.ts';
import { getMissileBarrels, AUTO_TURRET_BARREL } from '../tankClasses.ts';

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
  
  hasAutoTurret: boolean = false;
  missileType: MissileType = MissileType.None;
  autoAngle: number = 0;
  reloadTimers: number[] = [];
  angle: number = 0;
  spin: number = 0;
  spinAngle: number = 0;

  ownerClass: TankClass = TankClass.Basic;
  poolIndex: number = -1;

  constructor(pos: Vector, vel: Vector, ownerId: number, damage: number, penetration: number, radius: number = 8, color: string = '#00b2e1', isRailgun: boolean = false, ownerClass: TankClass = TankClass.Basic) {
    super(pos, radius, color, EntityType.BULLET, 1);
    this.init(pos, vel, ownerId, damage, penetration, radius, color, isRailgun, ownerClass);
  }

  init(pos: Vector, vel: Vector, ownerId: number, damage: number, penetration: number, radius: number = 8, color: string = '#00b2e1', isRailgun: boolean = false, ownerClass: TankClass = TankClass.Basic) {
    this.dead = true;
    this.id = Entity.nextEntityId++;
    this.pos = pos.copy();
    this.renderPos = pos.copy();
    this.vel = vel.copy();
    this.ownerId = ownerId;
    this.damage = damage;
    this.penetration = penetration;
    this.radius = radius;
    this.color = color;
    this.isRailgun = isRailgun;
    this.ownerClass = ownerClass;
    this.angle = Math.atan2(vel.y, vel.x);
    
    this.age = 0;
    this.deadTimer = 0;
    this.trail = [];
    this.isDamaging = false;
    this.hasAutoTurret = false;
    this.missileType = MissileType.None;
    this.autoAngle = 0;
    this.reloadTimers = [];
    this.spin = 0;
    this.spinAngle = 0;
    this.health = 1;
    this.maxHealth = 1;
    this.stateBuffer = [];
    this.visibility = 1;
    this.isInvisible = false;
    this.lastDamagedBy = null;
    this.dead = false;
  }

  update(dt: number) {
    if (this.dead) {
      if (this.isRailgun) {
        this.deadTimer += dt;
      }
      return;
    }
    
    super.update(dt);
    this.angle = Math.atan2(this.vel.y, this.vel.x);
    this.spinAngle += this.spin * dt;
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
    if (this.visibility <= 0) return;
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
        ctx.rotate(this.angle + this.spinAngle + barrel.angleOffset);
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

      // Draw body
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = darkenColor(this.color);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw auto turrets
      ctx.strokeStyle = '#727272';
      for (const barrel of barrels) {
        if (!barrel.autoAim) continue;
        
        ctx.save();
        
        // Draw turret base (before rotation if it's a square at 0,0)
        if (barrel.drawBase && barrel.baseType === 'square' && (barrel.xOffset || 0) === 0 && (barrel.yOffset || 0) === 0) {
          this.drawBarrelBase(ctx, barrel);
        }

        ctx.save();
        ctx.rotate(this.autoAngle + this.spinAngle + barrel.angleOffset);
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

export class BulletPool {
  private deadStack: Bullet[] = [];
  private activeBullets: Bullet[] = [];

  constructor(initialSize: number = 50) {
    this.allocateBatch(initialSize);
  }

  private allocateBatch(size: number) {
    for (let i = 0; i < size; i++) {
      const bullet = new Bullet(new Vector(0, 0), new Vector(0, 0), -1, 0, 0);
      bullet.dead = true;
      this.deadStack.push(bullet);
    }
  }

  spawn(pos: Vector, vel: Vector, ownerId: number, damage: number, penetration: number, radius: number = 8, color: string = '#00b2e1', isRailgun: boolean = false, ownerClass: TankClass = TankClass.Basic): Bullet {
    if (this.deadStack.length === 0) {
      this.allocateBatch(50);
    }
    const bullet = this.deadStack.pop()!;
    bullet.init(pos, vel, ownerId, damage, penetration, radius, color, isRailgun, ownerClass);
    bullet.poolIndex = this.activeBullets.length;
    this.activeBullets.push(bullet);
    return bullet;
  }

  despawn(index: number) {
    if (index < 0 || index >= this.activeBullets.length) return;
    const bullet = this.activeBullets[index];
    bullet.dead = true;
    
    // Swap-and-Pop
    const lastIdx = this.activeBullets.length - 1;
    if (index !== lastIdx) {
      const lastBullet = this.activeBullets[lastIdx];
      this.activeBullets[index] = lastBullet;
      lastBullet.poolIndex = index;
    }
    this.activeBullets.pop();
    bullet.poolIndex = -1;
    this.deadStack.push(bullet);
  }

  get active(): Bullet[] {
    return this.activeBullets;
  }

  clear() {
    while (this.activeBullets.length > 0) {
      const bullet = this.activeBullets.pop()!;
      bullet.dead = true;
      this.deadStack.push(bullet);
    }
  }
}
