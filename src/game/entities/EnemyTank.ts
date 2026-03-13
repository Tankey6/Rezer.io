import { Entity } from './Entity.ts';
import { Vector } from '../Vector.ts';
import { EntityType, TankClass, BarrelDef, ShapeType } from '../types.ts';
import { TANK_CLASSES, UPGRADE_PATHS } from '../tankClasses.ts';
import { darkenColor } from '../utils.ts';
import { Bullet } from './Bullet.ts';
import { Trap } from './Trap.ts';
import { Drone } from './Drone.ts';

const AI_NAMES = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'X-ray', 'Yankee', 'Zulu', 'Bot', 'Destroyer', 'Terminator', 'Glitch'
];

export class EnemyTank extends Entity {
  name: string = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] + ' (AI)';
  tankClass: TankClass;
  angle: number = Math.random() * Math.PI * 2;
  targetAngle: number = 0;
  barrelAngles: number[] = [];
  barrelTimers: number[] = [];
  stats = {
    healthRegen: 0,
    maxHealth: 0,
    bodyDamage: 0,
    bulletSpeed: 0,
    bulletPenetration: 0,
    bulletDamage: 0,
    reload: 0,
    movementSpeed: 0
  };
  level: number = 1;
  xp: number = 0;
  xpNeeded: number = 100;
  skillPoints: number = 0;
  target: Entity | null = null;
  wanderAngle: number = Math.random() * Math.PI * 2;
  wanderTime: number = 0;

  constructor(pos: Vector, tankClass: TankClass, level: number) {
    super(pos, 20, '#fc7677', EntityType.ENEMY_TANK, 300);
    this.tankClass = tankClass;
    
    const barrels = TANK_CLASSES[tankClass];
    const baseReloadTime = Math.max(0.05, Math.pow(0.9, this.stats.reload));
    this.barrelAngles = barrels.map(b => this.angle + b.angleOffset);
    this.barrelTimers = barrels.map(b => {
      const reloadTime = baseReloadTime * b.reloadMult;
      return reloadTime * (1 - b.delay);
    });

    // Initial leveling
    for (let i = 1; i < level; i++) {
      this.levelUp();
    }
    this.autoUpgradeClass();
  }

  gainXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpNeeded) {
      this.levelUp();
    }
  }

  levelUp() {
    this.xp -= this.xpNeeded;
    this.level++;
    this.xpNeeded = Math.floor(100 * Math.pow(this.level, 1.5));
    
    let getsSkillPoint = false;
    if (this.level <= 29) getsSkillPoint = true;
    else if (this.level >= 31 && this.level <= 39 && this.level % 2 !== 0) getsSkillPoint = true;
    else if (this.level === 41 || this.level === 45) getsSkillPoint = true;
    else if (this.level >= 50 && this.level % 5 === 0) getsSkillPoint = true;

    if (getsSkillPoint) {
      this.skillPoints++;
      this.autoUpgradeStats();
    }
    
    this.maxHealth += 15;
    this.health = this.maxHealth;
    this.autoUpgradeClass();
  }

  autoUpgradeStats() {
    const statKeys: (keyof typeof this.stats)[] = [
      'healthRegen', 'maxHealth', 'bodyDamage', 'bulletSpeed', 
      'bulletPenetration', 'bulletDamage', 'reload', 'movementSpeed'
    ];

    // Priority 1: 5, 6, 7 (Penetration, Damage, Reload)
    const p1 = [4, 5, 6]; // 0-indexed: 4=Pen, 5=Damage, 6=Reload
    // Priority 2: 4, 8 (Bullet Speed, Movement Speed)
    const p2 = [3, 7]; // 0-indexed: 3=BulletSpeed, 7=MoveSpeed
    // Priority 3: 1, 2, 3 (Regen, Health, Body)
    const p3 = [0, 1, 2];

    while (this.skillPoints > 0) {
      let upgraded = false;
      
      for (const group of [p1, p2, p3]) {
        const available = group.filter(idx => this.stats[statKeys[idx]] < 7);
        if (available.length > 0) {
          const idx = available[Math.floor(Math.random() * available.length)];
          this.stats[statKeys[idx]]++;
          this.skillPoints--;
          upgraded = true;
          break;
        }
      }

      if (!upgraded) break; // All stats maxed
    }
  }

  autoUpgradeClass() {
    const upgrades = UPGRADE_PATHS[this.tankClass];
    if (!upgrades) return;

    const getRequiredLevel = (tank: TankClass) => {
      const tier1 = [TankClass.Twin, TankClass.Sniper, TankClass.MachineGun, TankClass.FlankGuard, TankClass.Director, TankClass.Trapper, TankClass.Pounder];
      const tier2 = [
        TankClass.TripleShot, TankClass.QuadTank, TankClass.TwinFlank, TankClass.Wark,
        TankClass.Assassin, TankClass.Hunter,
        TankClass.Gunner, TankClass.MachineTrapper, TankClass.GatlingGun,
        TankClass.Destroyer, TankClass.MegaTrapper, TankClass.Composition,
        TankClass.TriAngle, TankClass.Auto3, TankClass.TriTrapper, TankClass.TrapGuard,
        TankClass.Overseer, TankClass.Cruiser, TankClass.Manager,
        TankClass.Howitzer
      ];
      if (tier1.includes(tank)) return 15;
      if (tier2.includes(tank)) return 30;
      return 45;
    };

    const available = upgrades.filter(u => this.level >= getRequiredLevel(u));
    if (available.length > 0) {
      this.tankClass = available[Math.floor(Math.random() * available.length)];
      const barrels = TANK_CLASSES[this.tankClass];
      const baseReloadTime = Math.max(0.05, Math.pow(0.9, this.stats.reload));
      this.barrelAngles = barrels.map(b => this.angle + b.angleOffset);
      this.barrelTimers = barrels.map(b => {
        const reloadTime = baseReloadTime * b.reloadMult;
        return reloadTime * (1 - b.delay);
      });
      // Recurse to check for further upgrades (e.g. 1 -> 15 -> 30)
      this.autoUpgradeClass();
    }
  }

  calculateThreat(e: Entity): number {
    const dist = this.pos.dist(e.pos);
    if (dist > 1000) return 0;

    let baseThreat = 0;
    switch (e.type) {
      case EntityType.PLAYER: baseThreat = 100; break;
      case EntityType.ENEMY_TANK: baseThreat = 80; break;
      case EntityType.DRONE: baseThreat = 30; break;
      case EntityType.CRASHER: baseThreat = 20; break;
      case EntityType.SHAPE: baseThreat = 10; break;
      default: baseThreat = 5;
    }

    // Closer is more dangerous
    return baseThreat / Math.max(1, dist / 100);
  }

  strafeDir: number = Math.random() < 0.5 ? 1 : -1;
  strafeTime: number = 0;

  tick(dt: number, entities: Entity[], spawn: (type: 'bullet' | 'trap' | 'drone' | 'cruiser_drone', pos: Vector, vel: Vector, stats: any, barrel: BarrelDef) => void, droneCount: number, cruiserDroneCount: number) {
    // AI: Threat-based Target Selection
    let bestTarget = null;
    let maxThreat = -1;

    for (const e of entities) {
      if (e === this || e.dead || e.id === this.id) continue;
      const threat = this.calculateThreat(e);
      if (threat > maxThreat) {
        maxThreat = threat;
        bestTarget = e;
      }
    }

    this.target = bestTarget;

    if (this.target) {
      const dist = this.pos.dist(this.target.pos);
      const dir = this.target.pos.sub(this.pos).normalize();
      this.targetAngle = Math.atan2(this.target.pos.y - this.pos.y, this.target.pos.x - this.pos.x);
      
      // Class-based distance management
      let idealDist = 250;
      if (this.tankClass.includes('Sniper') || this.tankClass.includes('Assassin') || this.tankClass.includes('Ranger') || this.tankClass.includes('Hunter')) {
        idealDist = 500;
      } else if (this.tankClass.includes('Destroyer') || this.tankClass.includes('Annihilator')) {
        idealDist = 350;
      }

      // Movement logic: Maintain distance + Strafe
      let moveVec = new Vector(0, 0);
      
      // Distance maintenance
      if (dist > idealDist + 50) {
        moveVec = moveVec.add(dir);
      } else if (dist < idealDist - 50) {
        moveVec = moveVec.add(dir.mult(-1));
      }

      // Strafe
      this.strafeTime -= dt;
      if (this.strafeTime <= 0) {
        this.strafeDir *= -1;
        this.strafeTime = 1 + Math.random() * 2;
      }
      const strafeVec = new Vector(-dir.y, dir.x).mult(this.strafeDir);
      moveVec = moveVec.add(strafeVec.mult(0.8));

      const speedMult = 100 + this.stats.movementSpeed * 10;
      this.vel = this.vel.add(moveVec.normalize().mult(speedMult * 1.2 * dt)).limit(speedMult * 1.5);

    } else {
      // Wander
      this.wanderTime -= dt;
      if (this.wanderTime <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTime = 2 + Math.random() * 3;
      }
      const wanderDir = new Vector(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle));
      this.vel = this.vel.add(wanderDir.mult(50 * dt)).limit(80);
      this.targetAngle = this.wanderAngle;
    }

    // Smooth rotation
    const angleDiff = this.targetAngle - this.angle;
    const shortestDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    this.angle += shortestDiff * 5 * dt;

    // Shooting logic
    const barrels = TANK_CLASSES[this.tankClass];
    const baseReloadTime = Math.max(0.05, Math.pow(0.9, this.stats.reload));
    
    let isAnyBarrelShooting = false;
    for (let i = 0; i < barrels.length; i++) {
      const barrel = barrels[i];
      
      if (barrel.autoAim) {
        // Auto-turret logic: Find nearest target within 180 degree FOV
        let nearestTarget = null;
        let minDist = 600;
        const barrelBaseAngle = this.angle + (barrel.posAngle !== undefined ? barrel.posAngle : barrel.angleOffset);

        for (const target of entities) {
          if (target === this || target.dead || target.id === this.id) continue;
          if ('shapeType' in target && (target as any).shapeType === ShapeType.ROCK) continue;
          
          const angleToTarget = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
          const angleDiffFromBase = Math.atan2(Math.sin(angleToTarget - barrelBaseAngle), Math.cos(angleToTarget - barrelBaseAngle));
          
          if (Math.abs(angleDiffFromBase) > Math.PI / 2) continue; // 180 degree FOV

          const dist = this.pos.dist(target.pos);
          if (dist < minDist) {
            minDist = dist;
            nearestTarget = target;
          }
        }

        if (nearestTarget) {
          const targetAngle = Math.atan2(nearestTarget.pos.y - this.pos.y, nearestTarget.pos.x - this.pos.x);
          const bAngleDiff = targetAngle - this.barrelAngles[i];
          const bShortestDiff = Math.atan2(Math.sin(bAngleDiff), Math.cos(bAngleDiff));
          this.barrelAngles[i] += bShortestDiff * 10 * dt;
          
          // Clamp to 180 degree limit relative to tank rotation
          const finalAngleDiff = Math.atan2(Math.sin(this.barrelAngles[i] - barrelBaseAngle), Math.cos(this.barrelAngles[i] - barrelBaseAngle));
          if (Math.abs(finalAngleDiff) > Math.PI / 2) {
            this.barrelAngles[i] = barrelBaseAngle + (finalAngleDiff > 0 ? Math.PI / 2 : -Math.PI / 2);
          }
        } else {
          // Return to home position
          const bAngleDiff = barrelBaseAngle - this.barrelAngles[i];
          const bShortestDiff = Math.atan2(Math.sin(bAngleDiff), Math.cos(bAngleDiff));
          this.barrelAngles[i] += bShortestDiff * 5 * dt;
        }
      } else {
        this.barrelAngles[i] = this.angle + barrel.angleOffset;
      }
      
      let isShooting = !!this.target;
      if (barrel.autoAim) {
        // Check if auto-turret has a target
        let hasAutoTarget = false;
        for (const target of entities) {
          if (target === this || target.dead || target.id === this.id) continue;
          if ('shapeType' in target && (target as any).shapeType === ShapeType.ROCK) continue;
          if (this.pos.dist(target.pos) < 600) {
            hasAutoTarget = true;
            break;
          }
        }
        isShooting = hasAutoTarget;
      }

      if (barrel.type === 'trap') isShooting = true; // Trappers fire constantly to build a field
      if (barrel.visualOnly) isShooting = false;
      if (isShooting) isAnyBarrelShooting = true;

      if (isShooting) {
        const reloadTime = baseReloadTime * barrel.reloadMult;
        this.barrelTimers[i] += dt;

        if (this.barrelTimers[i] >= reloadTime) {
          this.barrelTimers[i] -= reloadTime;
          
          const bAngle = this.barrelAngles[i];
          const bForward = new Vector(Math.cos(bAngle), Math.sin(bAngle));
          const bRight = new Vector(Math.cos(bAngle + Math.PI/2), Math.sin(bAngle + Math.PI/2));
          
          let spawnPos;
          if (barrel.posDist !== undefined && barrel.posAngle !== undefined) {
            const pAngle = this.angle + barrel.posAngle;
            spawnPos = this.pos.add(new Vector(Math.cos(pAngle) * barrel.posDist, Math.sin(pAngle) * barrel.posDist)).add(bForward.mult(barrel.length));
          } else {
            spawnPos = this.pos.add(bForward.mult(barrel.xOffset)).add(bRight.mult(barrel.yOffset)).add(bForward.mult(barrel.length));
          }
          
          const bulletSpeed = (400 + this.stats.bulletSpeed * 60) * barrel.speedMult;
          const bulletDamage = (750 + this.stats.bulletDamage * 150) * barrel.damageMult * (bulletSpeed / 400);
          const bulletPen = (0.2 + this.stats.bulletPenetration * 0.05) * barrel.penMult;
          
          const spread = (Math.random() - 0.5) * barrel.spread;
          const vel = new Vector(Math.cos(bAngle + spread), Math.sin(bAngle + spread)).mult(bulletSpeed);
          
          const type = barrel.type || 'bullet';
          
          if (type === 'drone' || type === 'cruiser_drone') {
            const currentCount = type === 'cruiser_drone' ? cruiserDroneCount : droneCount;
            if (currentCount < (barrel.maxDrones || 8)) {
              spawn(type, spawnPos, vel, { bulletDamage, bulletPen, bulletSpeed }, barrel);
            }
          } else {
            spawn(type, spawnPos, vel, { bulletDamage, bulletPen, bulletSpeed }, barrel);
          }

          // Recoil
          const recoil = barrel.recoilMult !== undefined ? barrel.recoilMult : barrel.damageMult;
          this.vel = this.vel.sub(bForward.mult(20 * recoil));
        }
      } else {
        const reloadTime = baseReloadTime * barrel.reloadMult;
        const targetTime = reloadTime * (1 - barrel.delay);
        this.barrelTimers[i] += dt;
        if (this.barrelTimers[i] > targetTime) {
          this.barrelTimers[i] = targetTime;
        }
      }
    }

    super.update(dt);
    this.vel = this.vel.mult(0.98);

    // Invisibility logic
    const canBeInvisible = this.tankClass === TankClass.Manager || this.tankClass === TankClass.Stalker;
    if (canBeInvisible) {
      const isMoving = this.vel.mag() > 10;
      if (isMoving || isAnyBarrelShooting) {
        this.visibility = Math.min(1, this.visibility + dt * 4);
      } else {
        this.visibility = Math.max(0, this.visibility - dt * 1.5);
      }
    } else {
      this.visibility = 1;
    }
    this.isInvisible = this.visibility < 0.1;
    
    // Regen
    if (this.health < this.maxHealth) {
      this.health += (0.5 + this.stats.healthRegen * 1.5) * dt;
      if (this.health > this.maxHealth) this.health = this.maxHealth;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.visibility;
    ctx.translate(this.renderPos.x, this.renderPos.y);
    ctx.rotate(this.angle);

    const outlineColor = darkenColor(this.color);
    const barrelColor = '#999999';
    const barrelOutline = darkenColor(barrelColor);

    // Draw barrels (non-autoAim)
    const barrels = TANK_CLASSES[this.tankClass];
    ctx.fillStyle = barrelColor;
    ctx.strokeStyle = barrelOutline;
    ctx.lineWidth = 3;

    for (let i = 0; i < barrels.length; i++) {
      const barrel = barrels[i];
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
      
      const w = barrel.width;
      const l = barrel.length;
      const we = barrel.widthEnd !== undefined ? barrel.widthEnd : w;
      
      ctx.beginPath();
      ctx.moveTo(0, -w/2);
      ctx.lineTo(l, -we/2);
      ctx.lineTo(l, we/2);
      ctx.lineTo(0, w/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw auto turrets (on top of body)
    ctx.strokeStyle = barrelOutline;
    for (let i = 0; i < barrels.length; i++) {
      const barrel = barrels[i];
      if (!barrel.autoAim) continue;
      
      ctx.save();
      
      if (barrel.posDist !== undefined && barrel.posAngle !== undefined) {
        ctx.rotate(barrel.posAngle);
        ctx.translate(barrel.posDist, 0);
        
        ctx.save();
        ctx.rotate(this.barrelAngles[i] - (this.angle + barrel.posAngle));
        ctx.translate(barrel.xOffset || 0, barrel.yOffset || 0);
        
        // Draw barrel
        ctx.fillStyle = barrelColor;
        ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
        ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
        ctx.restore();
        
        // Draw turret base
        if (barrel.drawBase !== false) {
          ctx.beginPath();
          ctx.arc(0, 0, barrel.baseRadius || (barrel.width * 0.75), 0, Math.PI * 2);
          ctx.fillStyle = barrelColor;
          ctx.fill();
          ctx.stroke();
        }
        
      } else {
        ctx.translate(barrel.xOffset, barrel.yOffset);
        ctx.rotate(this.barrelAngles[i] - this.angle);
        
        ctx.fillStyle = barrelColor;
        ctx.fillRect(0, -barrel.width / 2, barrel.length, barrel.width);
        ctx.strokeRect(0, -barrel.width / 2, barrel.length, barrel.width);
        
        // Draw turret base
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

    // Health bar
    if (this.health < this.maxHealth) {
      ctx.fillStyle = '#555555';
      ctx.fillRect(this.renderPos.x - 20, this.renderPos.y + this.radius + 10, 40, 5);
      ctx.fillStyle = '#86c680';
      ctx.fillRect(this.renderPos.x - 20, this.renderPos.y + this.radius + 10, 40 * Math.max(0, this.health / this.maxHealth), 5);
    }
  }
}
