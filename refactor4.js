import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// Replace class Game {
content = content.replace('export class Game {', `export class Game {
  isServer: boolean = false;
  players: Map<number, Player> = new Map();
  myPlayerId: number | null = null;
  inputs: Map<number, any> = new Map();`);

// Replace player: Player;
content = content.replace('  player: Player;', `  get player(): Player {
    if (this.myPlayerId !== null && this.players.has(this.myPlayerId)) {
      return this.players.get(this.myPlayerId)!;
    }
    return new Player(new Vector(0, 0));
  }`);

// Replace constructor
content = content.replace(/  constructor\(canvas: HTMLCanvasElement\) {[\s\S]*?this\.setupInputs\(\);\n  }/, `  constructor(canvas?: HTMLCanvasElement, isServer: boolean = false) {
    this.isServer = isServer;
    if (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d')!;
      this.width = canvas.width;
      this.height = canvas.height;
      this.setupInputs();
    }
    this.initShapes();
    this.initEnemies();
  }`);

// Replace update method
// We will just replace the whole update method with a new one that iterates over this.players.
// Since it's too long, I will use a regex to match the whole update method and replace it.
const updateRegex = /  update\(dt: number\) {[\s\S]*?  }\n\n  applySoftBorder/g;
const newUpdate = `  update(dt: number) {
    // Update players
    for (const [playerId, player] of this.players.entries()) {
      const input = this.inputs.get(playerId) || { keys: {}, mousePos: new Vector(0, 0), mouseDown: false, autoFire: false };
      
      if (player.classChanged) {
        this.drones = this.drones.filter(d => d.ownerId !== player.id);
        player.classChanged = false;
      }

      const speed = 200 + player.stats.movementSpeed * 12;
      const accel = speed * 3.0;
      
      if (input.keys['w'] || input.keys['arrowup']) player.vel.y -= accel * dt;
      if (input.keys['s'] || input.keys['arrowdown']) player.vel.y += accel * dt;
      if (input.keys['a'] || input.keys['arrowleft']) player.vel.x -= accel * dt;
      if (input.keys['d'] || input.keys['arrowright']) player.vel.x += accel * dt;

      // Player aiming
      player.angle = Math.atan2(input.mousePos.y - player.pos.y, input.mousePos.x - player.pos.x);

      const isShooting = input.mouseDown || input.autoFire;
      player.shooting = isShooting;
      const barrels = TANK_CLASSES[player.tankClass];
      const baseReloadTime = Math.max(0.05, Math.pow(0.9, player.stats.reload));
      
      let playerDroneCount = 0;
      let playerCruiserDroneCount = 0;
      for (const d of this.drones) {
        if (d.ownerId === player.id) {
          if (d.isCruiser) playerCruiserDroneCount++;
          else playerDroneCount++;
        }
      }

      for (let i = 0; i < barrels.length; i++) {
        const barrel = barrels[i];
        let barrelShooting = isShooting;
        let barrelAngle = player.angle + barrel.angleOffset;
        let spawnPos = player.pos;

        if (barrel.posDist !== undefined && barrel.posAngle !== undefined) {
           const pAngle = player.angle + barrel.posAngle;
           spawnPos = spawnPos.add(new Vector(Math.cos(pAngle) * barrel.posDist, Math.sin(pAngle) * barrel.posDist));
        } else {
           const bAngle = player.angle + barrel.angleOffset;
           const bForward = new Vector(Math.cos(bAngle), Math.sin(bAngle));
           const bRight = new Vector(Math.cos(bAngle + Math.PI/2), Math.sin(bAngle + Math.PI/2));
           spawnPos = spawnPos.add(bForward.mult(barrel.xOffset)).add(bRight.mult(barrel.yOffset));
        }

        if (barrel.autoAim) {
          let nearestShape = null;
          let minDist = 600;
          for (const s of this.shapes) {
            if (s.dead) continue;
            const dist = spawnPos.dist(s.pos);
            if (dist < minDist) {
              minDist = dist;
              nearestShape = s;
            }
          }
          
          if (nearestShape) {
            barrelAngle = Math.atan2(nearestShape.pos.y - spawnPos.y, nearestShape.pos.x - spawnPos.x);
            player.barrelAngles[i] = barrelAngle;
            barrelShooting = true;
          } else {
            barrelShooting = false;
            barrelAngle = player.barrelAngles[i] ?? (player.angle + barrel.angleOffset);
          }
        } else {
          player.barrelAngles[i] = barrelAngle;
        }

        if (barrel.visualOnly) {
          barrelShooting = false;
        }

        if (barrelShooting) {
          const reloadTime = baseReloadTime * barrel.reloadMult;
          player.barrelTimers[i] += dt;
          
          if (player.barrelTimers[i] >= reloadTime) {
            player.barrelTimers[i] -= reloadTime;
            
            const bulletSpeed = (400 + player.stats.bulletSpeed * 60) * barrel.speedMult;
            const bulletDamage = (750 + player.stats.bulletDamage * 150) * barrel.damageMult * (bulletSpeed / 400);
            const bulletPenetration = (0.2 + player.stats.bulletPenetration * 0.05) * barrel.penMult;
            const bulletRadius = 8 * (barrel.bulletSizeMult || 1);
            
            const angle = barrelAngle + (Math.random() - 0.5) * barrel.spread;
            const dir = new Vector(Math.cos(angle), Math.sin(angle));
            
            if (barrel.autoAim) {
              const bForward = new Vector(Math.cos(barrelAngle), Math.sin(barrelAngle));
              spawnPos = spawnPos.add(bForward.mult(barrel.length));
            } else {
              const bForward = new Vector(Math.cos(barrelAngle), Math.sin(barrelAngle));
              spawnPos = spawnPos.add(bForward.mult(barrel.length));
            }
              
            const vel = dir.mult(bulletSpeed);
            
            if (barrel.type === 'trap') {
               this.traps.push(new Trap(spawnPos, vel, player.id, player.color, bulletDamage, bulletPenetration, bulletRadius * 1.5));
            } else if (barrel.type === 'drone' || barrel.type === 'cruiser_drone') {
               const isCruiser = barrel.type === 'cruiser_drone';
               const currentCount = isCruiser ? playerCruiserDroneCount : playerDroneCount;
               if (currentCount < (barrel.maxDrones || 8)) {
                  const dSpeed = isCruiser ? bulletSpeed * 0.66 : bulletSpeed * 0.33;
                  const dRadius = isCruiser ? bulletRadius * 1.2 : bulletRadius * 1.8;
                  const dPenetration = isCruiser ? 1 : bulletPenetration;
                  const dDamage = isCruiser ? bulletDamage * 0.25 : bulletDamage;
                  this.drones.push(new Drone(spawnPos, vel, player.id, player.color, dDamage, dPenetration, dRadius, dSpeed, isCruiser));
                  if (isCruiser) playerCruiserDroneCount++;
                  else playerDroneCount++;
               }
            } else {
               this.bullets.push(new Bullet(spawnPos, vel, player.id, bulletDamage, bulletPenetration, bulletRadius));
            }
            
            const recoil = barrel.recoilMult !== undefined ? barrel.recoilMult : barrel.damageMult;
            player.vel = player.vel.sub(dir.mult(20 * recoil));
          }
        } else {
          const reloadTime = baseReloadTime * barrel.reloadMult;
          const targetTime = reloadTime * (1 - barrel.delay);
          player.barrelTimers[i] += dt;
          if (player.barrelTimers[i] > targetTime) {
            player.barrelTimers[i] = targetTime;
          }
        }
      }

      player.update(dt);
      if (player.dead) {
        for (const d of this.drones) {
          if (d.ownerId === player.id) d.dead = true;
        }
        this.players.delete(playerId);
        this.inputs.delete(playerId);
      } else {
        this.applySoftBorder(player, dt);
      }
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      const margin = 500;
      if (b.dead || b.pos.x < -margin || b.pos.x > this.worldSize.width + margin || b.pos.y < -margin || b.pos.y > this.worldSize.height + margin) {
        this.bullets.splice(i, 1);
      }
    }

    // Update traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.update(dt);
      this.applySoftBorder(t, dt);
      const margin = 1000;
      if (t.dead || t.pos.x < -margin || t.pos.x > this.worldSize.width + margin || t.pos.y < -margin || t.pos.y > this.worldSize.height + margin) {
        this.traps.splice(i, 1);
      }
    }

    // Update drones
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      
      const ownerPlayer = this.players.get(d.ownerId);
      if (ownerPlayer) {
        const input = this.inputs.get(d.ownerId) || { mouseDown: false, autoFire: false, mousePos: new Vector(0,0) };
        if (input.mouseDown || input.autoFire) {
          d.targetPos = input.mousePos;
        } else {
          const angle = (performance.now() / 1000) + (i * Math.PI * 2 / 8);
          d.targetPos = ownerPlayer.pos.add(new Vector(Math.cos(angle) * 100, Math.sin(angle) * 100));
        }
      } else {
        const ownerEnemy = this.enemies.find(e => e.id === d.ownerId);
        if (ownerEnemy) {
          if (ownerEnemy.target) {
            d.targetPos = ownerEnemy.target.pos;
          } else {
            const angle = (performance.now() / 1000) + (i * Math.PI * 2 / 8);
            d.targetPos = ownerEnemy.pos.add(new Vector(Math.cos(angle) * 100, Math.sin(angle) * 100));
          }
        }
      }
      
      d.update(dt);
      this.applySoftBorder(d, dt);
      const margin = 1000;
      if (d.dead || d.pos.x < -margin || d.pos.x > this.worldSize.width + margin || d.pos.y < -margin || d.pos.y > this.worldSize.height + margin) {
        this.drones.splice(i, 1);
      }
    }

    // Update shapes
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      s.update(dt);
      this.applySoftBorder(s, dt);

      if (s.dead) {
        this.shapes.splice(i, 1);
        this.spawnShape();
      }
    }

    // Update crashers
    if (this.crashers.length < 40) {
      if (Math.random() < 0.1) this.spawnCrasher();
    }
    const allEntities: Entity[] = [...this.players.values(), ...this.drones, ...this.enemies];
    for (let i = this.crashers.length - 1; i >= 0; i--) {
      const c = this.crashers[i];
      c.tick(dt, allEntities);
      this.applySoftBorder(c, dt);
      if (c.dead) {
        this.crashers.splice(i, 1);
      }
    }

    // Update enemies
    if (this.enemies.length < 15) {
      if (Math.random() < 0.01) this.spawnEnemyTank();
    }
    const enemyTargets: Entity[] = [...this.players.values(), ...this.drones, ...this.shapes, ...this.enemies];
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      
      let droneCount = 0;
      let cruiserDroneCount = 0;
      for (const d of this.drones) {
        if (d.ownerId === e.id) {
          if (d.isCruiser) cruiserDroneCount++;
          else droneCount++;
        }
      }

      e.tick(dt, enemyTargets, (type, pos, vel, stats, barrel) => {
        const bulletRadius = 8 * (barrel.bulletSizeMult || 1);
        if (type === 'trap') {
          this.traps.push(new Trap(pos, vel, e.id, e.color, stats.bulletDamage, stats.bulletPen, bulletRadius * 1.5));
        } else if (type === 'drone' || type === 'cruiser_drone') {
          const isCruiser = type === 'cruiser_drone';
          const dRadius = isCruiser ? bulletRadius * 1.2 : bulletRadius * 1.8;
          this.drones.push(new Drone(pos, vel, e.id, e.color, stats.bulletDamage, stats.bulletPen, dRadius, stats.bulletSpeed * (isCruiser ? 0.66 : 0.33), isCruiser));
        } else {
          this.bullets.push(new Bullet(pos, vel, e.id, stats.bulletDamage, stats.bulletPen, bulletRadius, e.color));
        }
      }, droneCount, cruiserDroneCount);

      this.applySoftBorder(e, dt);

      if (e.dead) {
        this.enemies.splice(i, 1);
        for (const d of this.drones) {
          if (d.ownerId === e.id) d.dead = true;
        }
      }
    }

    this.checkCollisions(dt);

    // Camera follow player smoothly
    if (this.player && !this.player.dead) {
      this.camera.x += (this.player.pos.x - this.camera.x) * 10 * dt;
      this.camera.y += (this.player.pos.y - this.camera.y) * 10 * dt;
    }
    
    if (this.onStateChange && this.player && !this.player.dead) {
      this.onStateChange({
        level: this.player.level,
        xp: this.player.xp,
        xpNeeded: this.player.xpNeeded,
        skillPoints: this.player.skillPoints,
        stats: this.player.stats,
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        autoFire: this.inputs.get(this.myPlayerId!)?.autoFire || false,
        tankClass: this.player.tankClass,
        pendingUpgrades: this.player.pendingUpgrades
      });
    }
  }

  applySoftBorder`;

content = content.replace(updateRegex, newUpdate);

// Replace giveXp
content = content.replace(/  giveXp\(ownerId: number, amount: number\) {[\s\S]*?  }/, `  giveXp(ownerId: number, amount: number) {
    if (this.players.has(ownerId)) {
      this.players.get(ownerId)!.gainXp(amount);
    } else {
      const enemy = this.enemies.find(e => e.id === ownerId);
      if (enemy) enemy.gainXp(amount);
    }
  }`);

// Replace checkCollisions
// We need to replace this.player with this.players iteration
let checkCollisions = content.match(/  checkCollisions\(dt: number\) {([\s\S]*?)}/)[1];
let newCheckCollisions = checkCollisions.replace(/this\.player\.pos/g, 'p.pos')
  .replace(/this\.player\.radius/g, 'p.radius')
  .replace(/this\.player\.takeDamage/g, 'p.takeDamage')
  .replace(/this\.player\.vel/g, 'p.vel')
  .replace(/this\.player\.gainXp/g, 'p.gainXp')
  .replace(/this\.player\.stats/g, 'p.stats')
  .replace(/this\.player\.id/g, 'p.id')
  .replace(/this\.player\.dead/g, 'p.dead')
  .replace(/!this\.player\.dead/g, '!p.dead');

// Wrap player collision checks in loop
newCheckCollisions = newCheckCollisions.replace(/\/\/ Traps vs Player\n      if \(!t\.dead && !p\.dead/g, `// Traps vs Player\n      for (const p of this.players.values()) {\n        if (!t.dead && !p.dead`);
newCheckCollisions = newCheckCollisions.replace(/        p\.vel = p\.vel\.add\(dir\.mult\(100 \* dt\)\);\n      }/g, `        p.vel = p.vel.add(dir.mult(100 * dt));\n        }\n      }`);

newCheckCollisions = newCheckCollisions.replace(/\/\/ Drones vs Player\n      if \(!d\.dead && !p\.dead/g, `// Drones vs Player\n      for (const p of this.players.values()) {\n        if (!d.dead && !p.dead`);
newCheckCollisions = newCheckCollisions.replace(/        d\.vel = d\.vel\.sub\(dir\.mult\(100 \* dt\)\);\n      }/g, `        d.vel = d.vel.sub(dir.mult(100 * dt));\n        }\n      }`);

newCheckCollisions = newCheckCollisions.replace(/\/\/ Player vs Shape\n    const bodyDamage = 400 \+ p\.stats\.bodyDamage \* 200;\n    for \(const s of this\.shapes\) {/g, `// Player vs Shape\n    for (const p of this.players.values()) {\n      const bodyDamage = 400 + p.stats.bodyDamage * 200;\n      for (const s of this.shapes) {`);
newCheckCollisions = newCheckCollisions.replace(/        if \(s\.dead\) p\.gainXp\(s\.xpValue\);\n      }\n    }/g, `        if (s.dead) p.gainXp(s.xpValue);\n      }\n    }\n    }`);

newCheckCollisions = newCheckCollisions.replace(/\/\/ Player vs Crasher\n    for \(const c of this\.crashers\) {/g, `// Player vs Crasher\n    for (const p of this.players.values()) {\n      const bodyDamage = 400 + p.stats.bodyDamage * 200;\n      for (const c of this.crashers) {`);
newCheckCollisions = newCheckCollisions.replace(/        if \(c\.dead\) p\.gainXp\(15\);\n      }\n    }/g, `        if (c.dead) p.gainXp(15);\n      }\n    }\n    }`);

newCheckCollisions = newCheckCollisions.replace(/\/\/ Bullet vs Player\n      if \(!b\.dead && b\.ownerId !== p\.id && b\.pos\.dist\(p\.pos\) < b\.radius \+ p\.radius\) {/g, `// Bullet vs Player\n      for (const p of this.players.values()) {\n        if (!b.dead && b.ownerId !== p.id && b.pos.dist(p.pos) < b.radius + p.radius) {`);
newCheckCollisions = newCheckCollisions.replace(/        p\.takeDamage\(b\.damage \* dt\);\n      }/g, `        p.takeDamage(b.damage * dt);\n        }\n      }`);

content = content.replace(checkCollisions, newCheckCollisions);

// Fix draw method to draw all players
content = content.replace(/    this\.player\.draw\(this\.ctx\);/g, `    for (const p of this.players.values()) p.draw(this.ctx);`);

// Fix drawMinimap to draw all players
content = content.replace(/    \/\/ Draw player\n    const px = x \+ \(this\.player\.pos\.x \/ this\.worldSize\.width\) \* size;\n    const py = y \+ \(this\.player\.pos\.y \/ this\.worldSize\.height\) \* size;\n\n    this\.ctx\.beginPath\(\);\n    this\.ctx\.arc\(px, py, 4, 0, Math\.PI \* 2\);\n    this\.ctx\.fillStyle = '#000000';\n    this\.ctx\.fill\(\);/g, `    // Draw players\n    for (const p of this.players.values()) {\n      const px = x + (p.pos.x / this.worldSize.width) * size;\n      const py = y + (p.pos.y / this.worldSize.height) * size;\n      this.ctx.beginPath();\n      this.ctx.arc(px, py, 4, 0, Math.PI * 2);\n      this.ctx.fillStyle = p.id === this.myPlayerId ? '#000000' : '#ff0000';\n      this.ctx.fill();\n    }`);

// Fix upgradeStat and upgradeClass
content = content.replace(/  upgradeStat\(stat: keyof Player\['stats'\]\) {[\s\S]*?  }\n\n  upgradeClass\(newClass: TankClass\) {[\s\S]*?  }/g, `  upgradeStat(stat: keyof Player['stats']) {
    if (this.player.skillPoints > 0 && this.player.stats[stat] < 7) {
      this.player.stats[stat]++;
      this.player.skillPoints--;
      if (stat === 'maxHealth') {
        this.player.maxHealth += 5;
        this.player.health += 5;
      }
    }
  }

  upgradeClass(newClass: TankClass) {
    this.player.upgradeClass(newClass);
  }`);

fs.writeFileSync('src/game/Game.ts', content);
