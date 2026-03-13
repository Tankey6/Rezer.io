import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// 1. Rename class
content = content.replace('export class Game {', 'export class ServerGame {');

// 2. Remove canvas/ctx/mouse/keys
content = content.replace(/  canvas: HTMLCanvasElement;\n  ctx: CanvasRenderingContext2D;\n  width: number;\n  height: number;\n/g, '');
content = content.replace(/  keys: { \[key: string\]: boolean } = {};\n  mousePos: Vector = new Vector\(0, 0\);\n  mouseDown: boolean = false;\n  autoFire: boolean = false;\n/g, '');
content = content.replace(/  \/\/ Mobile controls\n  isMobile: boolean = false;\n  leftJoystick: { .* } = { .* };\n  rightJoystick: { .* } = { .* };\n/g, '');
content = content.replace(/  camera: Vector = new Vector\(0, 0\);\n/g, '');

// 3. Replace player with players map
content = content.replace(/  player: Player;/g, '  players: Map<number, Player> = new Map();\n  inputs: Map<number, any> = new Map();');

// 4. Constructor
content = content.replace(/  constructor\(canvas: HTMLCanvasElement\) {[\s\S]*?this\.setupInputs\(\);\n  }/, `  constructor() {
    this.initShapes();
    this.initEnemies();
  }`);

// 5. Remove setupInputs, resize, draw, drawMinimap, drawJoysticks, upgradeStat, upgradeClass
content = content.replace(/  setupInputs\(\) {[\s\S]*?  }\n  \n  cleanup: \(\) => void = \(\) => {};/g, '');
content = content.replace(/  resize\(width: number, height: number\) {[\s\S]*?  }/g, '');
content = content.replace(/  draw\(\) {[\s\S]*?  }\n  \n  drawMinimap\(\) {[\s\S]*?  }\n  \n  drawJoysticks\(\) {[\s\S]*?  }/g, '');
content = content.replace(/  upgradeStat\(stat: keyof Player\['stats'\]\) {[\s\S]*?  }\n\n  upgradeClass\(newClass: TankClass\) {[\s\S]*?  }/g, '');

// 6. Fix spawnEnemyTank
content = content.replace(/    if \(pos\.dist\(this\.player\.pos\) < 1000\) {/g, '    let tooClose = false;\n    for (const p of this.players.values()) {\n      if (pos.dist(p.pos) < 1000) tooClose = true;\n    }\n    if (tooClose) {');

// 7. Fix update method
// We need to wrap the player update logic in a loop and replace this.player with player
let updateMethod = content.match(/  update\(dt: number\) {([\s\S]*?)    \/\/ Update bullets/)[1];
let newUpdateMethod = `
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
`;

content = content.replace(updateMethod, newUpdateMethod);

// Replace this.player in the rest of the file
content = content.replace(/this\.player\.dead/g, 'false');
content = content.replace(/this\.player\.id/g, '-1'); // Or handle properly
content = content.replace(/this\.player\.pos/g, 'new Vector(0,0)');
content = content.replace(/this\.player\.radius/g, '20');
content = content.replace(/this\.player\.takeDamage/g, '(() => {})');
content = content.replace(/this\.player\.vel/g, 'new Vector(0,0)');
content = content.replace(/this\.player\.gainXp/g, '(() => {})');

// Fix giveXp
content = content.replace(/  giveXp\(ownerId: number, amount: number\) {[\s\S]*?  }/, `  giveXp(ownerId: number, amount: number) {
    if (this.players.has(ownerId)) {
      this.players.get(ownerId)!.gainXp(amount);
    } else {
      const enemy = this.enemies.find(e => e.id === ownerId);
      if (enemy) enemy.gainXp(amount);
    }
  }`);

// Fix checkCollisions for players
let checkCollisions = content.match(/  checkCollisions\(dt: number\) {([\s\S]*?)}/)[1];
// Replace Player vs Shape, Player vs Crasher, Bullet vs Player, Drones vs Player, Traps vs Player
// This is getting too complex for regex. I will write a custom checkCollisions.

fs.writeFileSync('src/game/ServerGame.ts', content);
