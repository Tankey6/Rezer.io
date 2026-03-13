import { Entity } from './Entity';
import { Vector } from '../Vector';
import { EntityType, TankClass } from '../types';
import { darkenColor } from '../utils';
import { TANK_CLASSES, UPGRADE_PATHS } from '../tankClasses';

export class Player extends Entity {
  angle: number = 0;
  level: number = 1;
  xp: number = 0;
  xpNeeded: number = 100;
  skillPoints: number = 0;
  
  tankClass: TankClass = TankClass.Basic;
  pendingUpgrades: TankClass[] = [];
  
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

  lastShot: number = 0;
  lastHitTime: number = 0;
  barrelTimers: number[] = [];
  barrelAngles: number[] = [];
  shooting: boolean = false;
  autoSpin: boolean = false;
  isInvincible: boolean = false;
  spawnImmunityTimer: number = 0;

  classChanged: boolean = false;
  startTime: number = Date.now();
  name: string = 'Unnamed Tank';

  constructor(pos: Vector) {
    super(pos, 20, '#00b2e1', EntityType.PLAYER, 300);
    this.lastHitTime = Date.now();
    this.initBarrels();
  }

  initBarrels() {
    const barrels = TANK_CLASSES[this.tankClass];
    const baseReloadTime = Math.max(0.05, Math.pow(0.9, this.stats.reload));
    this.barrelTimers = barrels.map(b => {
      const reloadTime = baseReloadTime * b.reloadMult;
      return reloadTime * (1 - b.delay);
    });
    this.barrelAngles = barrels.map(b => this.angle + b.angleOffset);
  }

  upgradeClass(newClass: TankClass) {
    this.tankClass = newClass;
    this.pendingUpgrades = [];
    this.initBarrels();
    this.classChanged = true;
    this.checkUpgrades();
  }

  respawn(level: number) {
    this.level = level;
    this.xp = 0;
    this.xpNeeded = Math.floor(100 * Math.pow(this.level, 1.5));
    
    // Calculate skill points based on level
    this.skillPoints = 0;
    for (let l = 2; l <= this.level; l++) {
      if (l <= 29) {
        this.skillPoints++;
      } else if (l >= 31 && l <= 39) {
        if (l % 2 !== 0) this.skillPoints++;
      } else if (l === 41 || l === 45) {
        this.skillPoints++;
      } else if (l >= 50 && l % 5 === 0) {
        this.skillPoints++;
      }
    }
    
    this.tankClass = TankClass.Basic;
    this.pendingUpgrades = [];
    this.initBarrels();
    this.classChanged = true;
    this.health = 600 + (this.level - 1) * 20;
    this.maxHealth = this.health;
    this.stats = {
      healthRegen: 0,
      maxHealth: 0,
      bodyDamage: 0,
      bulletSpeed: 0,
      bulletPenetration: 0,
      bulletDamage: 0,
      reload: 0,
      movementSpeed: 0
    };
    this.dead = false;
    this.pos = new Vector(Math.random() * 9000, Math.random() * 9000);
    this.vel = new Vector(0, 0);
    this.isInvincible = true;
    this.spawnImmunityTimer = 3000;
    this.checkUpgrades();
  }

  checkUpgrades() {
    this.pendingUpgrades = [];
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
    
    this.pendingUpgrades = upgrades.filter(u => this.level >= getRequiredLevel(u));
  }

  update(dt: number) {
    super.update(dt);
    
    if (this.autoSpin) {
      this.angle += dt * 2;
    }
    
    if (this.isInvincible) {
      this.spawnImmunityTimer -= dt * 1000;
      if (this.spawnImmunityTimer <= 0 || this.vel.mag() > 10 || this.shooting) {
        this.isInvincible = false;
      }
    }

    // Smoother slowing down (higher friction multiplier means less speed loss per frame, but we want it to feel smoother)
    // Actually, to make slowing down smoother, we can use a slightly lower multiplier (more friction) or adjust acceleration.
    // Let's use 0.92 for a bit less friction so it slides a bit more, as requested.
    this.vel = this.vel.mult(0.92); // Friction
    
    if (this.health < this.maxHealth) {
      const timeSinceLastHit = (Date.now() - this.lastHitTime) / 1000;
      const healingMultiplier = Math.pow(1.05, Math.max(0, timeSinceLastHit - 5)); // Start healing exponentially after 5 seconds
      this.health += (0.5 + this.stats.healthRegen * 1.5) * healingMultiplier * dt;
      if (this.health > this.maxHealth) this.health = this.maxHealth;
    }

    // Invisibility logic
    const canBeInvisible = this.tankClass === TankClass.Manager || this.tankClass === TankClass.Stalker;
    if (canBeInvisible) {
      const isMoving = this.vel.mag() > 10;
      if (isMoving || this.shooting) {
        this.visibility = Math.min(1, this.visibility + dt * 4);
      } else {
        this.visibility = Math.max(0, this.visibility - dt * 1.5);
      }
    } else {
      this.visibility = 1;
    }
    this.isInvisible = this.visibility < 0.1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.visibility;
    ctx.translate(this.renderPos.x, this.renderPos.y);
    
    if (this.isInvincible) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

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
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Draw auto turrets (on top of body)
    ctx.strokeStyle = '#727272'; // barrelOutline
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
    
    // Draw health bar
    if (this.health < this.maxHealth) {
      ctx.fillStyle = '#555555';
      ctx.fillRect(this.renderPos.x - 20, this.renderPos.y + 30, 40, 6);
      ctx.fillStyle = '#86c680';
      ctx.fillRect(this.renderPos.x - 20, this.renderPos.y + 30, 40 * Math.max(0, this.health / this.maxHealth), 6);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.renderPos.x - 20, this.renderPos.y + 30, 40, 6);
    }
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
    
    // Calculate if we get a skill point this level
    let getsSkillPoint = false;
    if (this.level <= 29) {
      getsSkillPoint = true;
    } else if (this.level >= 31 && this.level <= 39) {
      if (this.level % 2 !== 0) getsSkillPoint = true; // Odd numbers
    } else if (this.level === 41 || this.level === 45) {
      getsSkillPoint = true;
    } else if (this.level >= 50 && this.level % 5 === 0) {
      getsSkillPoint = true;
    }

    if (getsSkillPoint) {
      this.skillPoints++;
    }
    
    const hpGain = 15;
    this.maxHealth += hpGain;
    this.health += hpGain;
    this.checkUpgrades();
  }

  takeDamage(amount: number, damagerId: number | null = null) {
    super.takeDamage(amount, damagerId);
    this.lastHitTime = Date.now();
  }
}
