import { WebSocketServer, WebSocket } from 'ws';
import { Game } from '../game/Game.ts';
import { BinaryReader, BinaryWriter } from '../game/binary.ts';
import { Vector } from '../game/Vector.ts';
import { Player } from '../game/entities/Player.ts';
import { Bullet } from '../game/entities/Bullet.ts';
import { Shape } from '../game/entities/Shape.ts';
import { EnemyTank } from '../game/entities/EnemyTank.ts';
import { Trap } from '../game/entities/Trap.ts';
import { Drone } from '../game/entities/Drone.ts';
import { Crasher } from '../game/entities/Crasher.ts';
import { calculateTotalXp } from '../game/utils.ts';
import http from 'http';

interface ExtWebSocket extends WebSocket {
  playerId?: number;
}

export function setupMultiplayer(server: http.Server) {
  const game = new Game(undefined, true);
  const playerSockets = new Map<number, ExtWebSocket>();
  
  let nextPlayerId = 1;

  game.onPlayerDeath = (playerId, killerId) => {
    console.log('onPlayerDeath called', playerId);
    const ws = playerSockets.get(playerId);
    if (ws) {
      console.log('Found socket for player', playerId);
      const player = game.players.get(playerId);
      if (player) {
        const survivalTime = Math.floor((Date.now() - player.startTime) / 1000);
        let killedBy = "Unknown";
        if (killerId !== null) {
          const killer = game.players.get(killerId);
          if (killer) {
            killedBy = killer.tankClass;
          } else {
            // Check enemies
            const enemy = game.enemies.find(e => e.id === killerId);
            if (enemy) {
              killedBy = enemy.tankClass;
            } else {
              // Check crashers
              const crasher = game.crashers.find(c => c.id === killerId);
              if (crasher) {
                killedBy = "Crasher";
              }
            }
          }
        }
        
        const writer = new BinaryWriter();
        writer.writeUint8(3); // DEATH
        writer.writeUint16(player.level);
        writer.writeString(player.tankClass);
        writer.writeUint32(survivalTime);
        writer.writeString(killedBy);
        ws.send(writer.getBuffer());
        console.log('DEATH packet sent to player', playerId);
        
        // Removed auto-respawn
      } else {
        console.log('Player not found for death packet', playerId);
      }
    } else {
      console.log('Socket not found for player', playerId);
    }
  };

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: ExtWebSocket, request: http.IncomingMessage) => {
    const playerId = nextPlayerId++;
    ws.playerId = playerId;
    playerSockets.set(playerId, ws);

    // Send init packet
    const writer = new BinaryWriter();
    writer.writeUint8(0); // INIT
    writer.writeUint32(playerId);
    ws.send(writer.getBuffer());

    ws.on('message', (message: Buffer) => {
      const data = new Uint8Array(message);
      const reader = new BinaryReader(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      const type = reader.readUint8();
      
      const playerId = ws.playerId!;
      if (type === 1) { // INPUT
        const input = game.inputs.get(playerId);
        if (input) {
          const sequence = reader.readUint32();
          input.lastSequence = sequence;
          input.keys['w'] = reader.readUint8() === 1;
          input.keys['a'] = reader.readUint8() === 1;
          input.keys['s'] = reader.readUint8() === 1;
          input.keys['d'] = reader.readUint8() === 1;
          input.mousePos.x = reader.readFloat32();
          input.mousePos.y = reader.readFloat32();
          input.mouseDown = reader.readUint8() === 1;
          input.autoFire = reader.readUint8() === 1;
          input.autoSpin = reader.readUint8() === 1;
          
          const player = game.players.get(playerId);
          if (player) {
            player.autoSpin = input.autoSpin;
          }
        }
      } else if (type === 2) { // UPGRADE_STAT
        const stat = reader.readString() as keyof Player['stats'];
        const player = game.players.get(playerId);
        if (player) {
          game.myPlayerId = playerId; // Temporarily set to use upgradeStat logic
          game.upgradeStat(stat);
          game.myPlayerId = null;
        }
      } else if (type === 3) { // UPGRADE_CLASS
        const newClass = reader.readString() as any;
        const player = game.players.get(playerId);
        if (player) {
          game.myPlayerId = playerId;
          game.upgradeClass(newClass);
          game.myPlayerId = null;
        }
      } else if (type === 4) { // SPAWN
        const name = reader.readString();
        console.log(`Spawn request received for player ${playerId} with name: ${name}`);
        
        // If player already exists, we can either ignore or reset them.
        // Let's reset them to allow "re-spawning" if they get stuck or want to change name.
        const player = new Player(new Vector(Math.random() * game.worldSize.width, Math.random() * game.worldSize.height));
        player.id = playerId;
        player.name = name;
        game.players.set(playerId, player);
        game.inputs.set(playerId, { keys: {}, mousePos: new Vector(0, 0), mouseDown: false, autoFire: false });
        console.log(`Player ${playerId} spawned/reset successfully`);
      } else if (type === 5) { // SYNC_REQUEST
        console.log(`Sync request received from player ${playerId}`);
        const writer = new BinaryWriter();
        writer.writeUint8(5); // SYNC_ACK
        ws.send(writer.getBuffer());
      }
    });

    ws.on('close', () => {
      playerSockets.delete(playerId);
      if (ws.playerId) {
        game.players.delete(ws.playerId);
        game.inputs.delete(ws.playerId);
        game.drones = game.drones.filter(d => d.ownerId !== ws.playerId);
        game.traps = game.traps.filter(t => t.ownerId !== ws.playerId);
      }
    });
  });

  console.log('WebSocket server listening on port 3001');

  // Game loop
  let lastTime = performance.now();
  let accumulator = 0;
  const fixedDt = 1 / 24;

  setInterval(() => {
    const now = performance.now();
    let frameTime = (now - lastTime) / 1000;
    if (frameTime > 0.25) frameTime = 0.25;
    lastTime = now;
    
    accumulator += frameTime;
    if (accumulator > 0.1) accumulator = 0.1;
    while (accumulator >= fixedDt) {
      game.update(fixedDt);
      accumulator -= fixedDt;
    }
    
    // Broadcast state per player (Culling)
    const writer = new BinaryWriter();
    for (const [playerId, ws] of playerSockets.entries()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const player = game.players.get(playerId);
      if (!player) continue;

      writer.reset();
      writer.writeUint8(1); // STATE
      writer.writeUint32(performance.now()); // Server timestamp
      
      // Culling radius (slightly larger than typical FOV to avoid pop-in)
      const cullRadius = 2500;
      
      const nearbyEntities = game.grid.getNearby(player.pos.x, player.pos.y, cullRadius);
      
      const visiblePlayers: Player[] = [];
      const visibleBullets: Bullet[] = [];
      const visibleShapes: Shape[] = [];
      const visibleEnemies: EnemyTank[] = [];
      const visibleTraps: Trap[] = [];
      const visibleDrones: Drone[] = [];
      const visibleCrashers: Crasher[] = [];

      let selfIncluded = false;

      for (const e of nearbyEntities) {
        if (e instanceof Player) {
          visiblePlayers.push(e);
          if (e.id === playerId) selfIncluded = true;
        }
        else if (e instanceof Bullet) visibleBullets.push(e);
        else if (e instanceof Shape) visibleShapes.push(e);
        else if (e instanceof EnemyTank) visibleEnemies.push(e);
        else if (e instanceof Trap) visibleTraps.push(e);
        else if (e instanceof Drone) visibleDrones.push(e);
        else if (e instanceof Crasher) visibleCrashers.push(e);
      }

      if (!selfIncluded) {
        visiblePlayers.push(player);
      }
      
      // Players
      writer.writeUint16(visiblePlayers.length);
      for (const p of visiblePlayers) {
        const input = game.inputs.get(p.id);
        writer.writeUint32(p.id);
        writer.writeUint32(input?.lastSequence || 0);
        writer.writeFloat32(p.pos.x);
        writer.writeFloat32(p.pos.y);
        writer.writeFloat32(p.vel.x);
        writer.writeFloat32(p.vel.y);
        writer.writeFloat32(p.angle);
        writer.writeFloat32(p.radius);
        writer.writeString(p.color);
        writer.writeString(p.tankClass);
        writer.writeString(p.name);
        writer.writeFloat32(p.health);
        writer.writeFloat32(p.maxHealth);
        writer.writeUint16(p.level);
        writer.writeFloat32(p.xp);
        writer.writeUint16(p.skillPoints);
        
        // Stats
        writer.writeUint8(p.stats.healthRegen);
        writer.writeUint8(p.stats.maxHealth);
        writer.writeUint8(p.stats.bodyDamage);
        writer.writeUint8(p.stats.bulletSpeed);
        writer.writeUint8(p.stats.bulletPenetration);
        writer.writeUint8(p.stats.bulletDamage);
        writer.writeUint8(p.stats.reload);
        writer.writeUint8(p.stats.movementSpeed);

        // Barrel Angles
        writer.writeUint8(p.barrelAngles.length);
        for (const angle of p.barrelAngles) {
          writer.writeFloat32(angle);
        }
      }
      
      // Bullets
      writer.writeUint16(visibleBullets.length);
      for (const b of visibleBullets) {
        writer.writeUint32(b.id);
        writer.writeFloat32(b.pos.x);
        writer.writeFloat32(b.pos.y);
        writer.writeFloat32(b.radius);
        writer.writeString(b.color);
        const flags = (b.isRailgun ? 1 : 0) | (b.dead ? 2 : 0);
        writer.writeUint8(flags);
      }
      
      // Shapes
      writer.writeUint16(visibleShapes.length);
      for (const s of visibleShapes) {
        writer.writeUint32(s.id);
        writer.writeFloat32(s.pos.x);
        writer.writeFloat32(s.pos.y);
        writer.writeFloat32(s.radius);
        writer.writeString(s.color);
        writer.writeUint8(s.shapeType);
        writer.writeFloat32(s.angle);
        writer.writeFloat32(s.health);
        writer.writeFloat32(s.maxHealth);
      }
      
      // Enemies
      writer.writeUint16(visibleEnemies.length);
      for (const e of visibleEnemies) {
        writer.writeUint32(e.id);
        writer.writeFloat32(e.pos.x);
        writer.writeFloat32(e.pos.y);
        writer.writeFloat32(e.angle);
        writer.writeFloat32(e.radius);
        writer.writeString(e.color);
        writer.writeString(e.tankClass);
        writer.writeString(e.name);
        writer.writeFloat32(e.health);
        writer.writeFloat32(e.maxHealth);

        // Barrel Angles
        writer.writeUint8(e.barrelAngles.length);
        for (const angle of e.barrelAngles) {
          writer.writeFloat32(angle);
        }
      }
      
      // Traps
      writer.writeUint16(visibleTraps.length);
      for (const t of visibleTraps) {
        writer.writeUint32(t.id);
        writer.writeFloat32(t.pos.x);
        writer.writeFloat32(t.pos.y);
        writer.writeFloat32(t.angle);
        writer.writeFloat32(t.radius);
        writer.writeString(t.color);
      }
      
      // Drones
      writer.writeUint16(visibleDrones.length);
      for (const d of visibleDrones) {
        writer.writeUint32(d.id);
        writer.writeFloat32(d.pos.x);
        writer.writeFloat32(d.pos.y);
        writer.writeFloat32(d.angle);
        writer.writeFloat32(d.radius);
        writer.writeString(d.color);
      }
      
      // Crashers
      writer.writeUint16(visibleCrashers.length);
      for (const c of visibleCrashers) {
        writer.writeUint32(c.id);
        writer.writeFloat32(c.pos.x);
        writer.writeFloat32(c.pos.y);
        writer.writeFloat32(c.angle);
        writer.writeFloat32(c.radius);
        writer.writeString(c.color);
        writer.writeFloat32(c.health);
        writer.writeFloat32(c.maxHealth);
      }

      // Leaderboard
      writer.writeUint8(game.leaderboard.length);
      for (const entry of game.leaderboard) {
        writer.writeString(entry.name);
        writer.writeFloat32(entry.score);
        // We need to know if this entry is a player to correctly identify them on client
        // But the game.leaderboard already has isPlayer based on the SERVER's perspective (which is wrong for individual clients)
        // So we'll find the ID if it's a player
        let entryId = 0;
        for (const [pid, p] of game.players.entries()) {
          if (p.name === entry.name && calculateTotalXp(p.level, p.xp) === entry.score) {
            entryId = pid;
            break;
          }
        }
        writer.writeUint32(entryId);
      }
      
      ws.send(writer.getBuffer());
    }
  }, 1000 / 60);
}
