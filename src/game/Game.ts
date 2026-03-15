import { Vector } from './Vector.ts';
import { Player } from './entities/Player.ts';
import { Bullet } from './entities/Bullet.ts';
import { Trap } from './entities/Trap.ts';
import { Drone } from './entities/Drone.ts';
import { Shape } from './entities/Shape.ts';
import { Crasher } from './entities/Crasher.ts';
import { EnemyTank } from './entities/EnemyTank.ts';
import { ShapeType, TankClass, EntityType, MissileType, BarrelDef, getEffectiveStat, CrasherType } from './types.ts';
import { TANK_CLASSES, getFovMult, getMissileBarrels, AUTO_TURRET_BARREL } from './tankClasses.ts';
import { Entity } from './entities/Entity.ts';
import { SpatialGrid } from './SpatialGrid.ts';
import { BinaryReader, BinaryWriter } from './binary.ts';
import { calculateTotalXp } from './utils.ts';

export class Game {
  isServer: boolean = false;
  onStateChange: ((state: any) => void) | null = null;
  onGameOver: ((deathInfo: { level: number, tankClass: string, survivalTime: number, killedBy: string, killerId: number }) => void) | null = null;
  onPlayerDeath: ((playerId: number, killerId: number | null) => void) | null = null;
  players: Map<number, Player> = new Map();
  myPlayerId: number | null = null;
  killerId: number | null = null;
  inputs: Map<number, any> = new Map();
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  
  worldSize = { width: 9000, height: 9000 };
  
  get player(): Player | undefined {
    if (this.myPlayerId !== null && this.players.has(this.myPlayerId)) {
      return this.players.get(this.myPlayerId)!;
    }
    return undefined;
  }
  bullets: Bullet[] = [];
  traps: Trap[] = [];
  drones: Drone[] = [];
  shapes: Shape[] = [];
  crashers: Crasher[] = [];
  enemies: EnemyTank[] = [];
  grid: SpatialGrid = new SpatialGrid(500);
  enemyMap: Map<number, EnemyTank> = new Map();
  bulletMap: Map<number, Bullet> = new Map();
  trapMap: Map<number, Trap> = new Map();
  droneMap: Map<number, Drone> = new Map();
  shapeMap: Map<number, Shape> = new Map();
  crasherMap: Map<number, Crasher> = new Map();
  
  // Persistent arrays for target lists to avoid per-frame allocations
  private crasherTargets: Entity[] = [];
  private enemyTargets: Entity[] = [];
  
  leaderboard: { name: string, score: number, isPlayer: boolean }[] = [];
  lastLeaderboardUpdate: number = -3000;

  keys: { [key: string]: boolean } = {};
  mousePos: Vector = new Vector(0, 0);
  mouseDown: boolean = false;
  autoFire: boolean = false;
  
  // Mobile controls
  isMobile: boolean = false;
  leftJoystick: { active: boolean, startPos: Vector, currentPos: Vector, touchId: number | null } = { active: false, startPos: new Vector(0, 0), currentPos: new Vector(0, 0), touchId: null };
  rightJoystick: { active: boolean, startPos: Vector, currentPos: Vector, touchId: number | null } = { active: false, startPos: new Vector(0, 0), currentPos: new Vector(0, 0), touchId: null };
  
  lastTime: number = 0;
  animationFrameId: number = 0;
  running: boolean = false;
  
  camera: Vector = new Vector(0, 0);
  cameraTargetId: number | null = null;
  
  ws: WebSocket | null = null;
  pendingSpawnName: string | null = null;
  isSpawning: boolean = false;
  spawnName: string = '';
  spawnRetryTimer: number = 0;
  spawnRetryCount: number = 0;
  
  sequenceNumber: number = 0;
  pendingInputs: { sequence: number, dt: number, keys: { [key: string]: boolean }, mousePos: Vector, mouseDown: boolean, autoFire: boolean, autoSpin: boolean }[] = [];
  
  serverTime: number = 0;
  localServerTime: number = 0;
  
  desyncTimer: number = 0;
  lastServerPos: Vector | null = null;
  lastServerVel: Vector | null = null;
  
  fixedDt: number = 1 / 60;
  accumulator: number = 0;

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('Connected to server');
      if (this.pendingSpawnName !== null) {
        this.spawn(this.pendingSpawnName, 1);
        this.pendingSpawnName = null;
      }
    };

    this.ws.onmessage = (event) => {
      const reader = new BinaryReader(event.data);
      const type = reader.readUint8();

      if (type === 0) { // INIT
        this.myPlayerId = reader.readUint32();
      } else if (type === 1) { // STATE
        const serverTimestamp = reader.readUint32();
        this.serverTime = serverTimestamp;
        
        // Sync localServerTime
        if (this.localServerTime === 0 || Math.abs(this.localServerTime - serverTimestamp) > 500) {
          this.localServerTime = serverTimestamp - 100; // 100ms interpolation delay
        }

        // Parse state
        this.parseState(reader, serverTimestamp);
      } else if (type === 5) { // SYNC_ACK
        console.log('Sync acknowledged by server');
        if (this.player && this.lastServerPos) {
          this.player.pos = this.lastServerPos.copy();
          this.player.vel = this.lastServerVel?.copy() || new Vector(0, 0);
        }
      } else if (type === 3) { // DEATH
        console.log('DEATH packet received');
        const level = reader.readUint16();
        const tankClass = reader.readString();
        const survivalTime = reader.readUint32();
        const killedBy = reader.readString();
        const killerId = reader.readUint32();
        console.log('Death info:', { level, tankClass, survivalTime, killedBy, killerId });
        if (this.onGameOver) {
          this.onGameOver({ level, tankClass, survivalTime, killedBy, killerId });
        }
      }
    };
  }

  spawn(name: string, level: number) {
    this.isSpawning = true;
    this.spawnName = name;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const writer = new BinaryWriter();
      writer.writeUint8(4); // SPAWN
      writer.writeString(name);
      writer.writeUint16(level);
      this.ws.send(writer.getBuffer());
    } else {
      this.pendingSpawnName = name;
    }
  }

  requestSync() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Sending sync request...');
      const writer = new BinaryWriter();
      writer.writeUint8(5); // SYNC_REQUEST
      this.ws.send(writer.getBuffer());
    }
  }

  forceSync() {
    console.log('FORCE SYNC TRIGGERED');
    this.pendingInputs = [];
    this.requestSync();
  }

  parseState(reader: BinaryReader, timestamp: number) {
    // Players
    const numPlayers = reader.readUint16();
    const currentPlayers = new Set<number>();
    for (let i = 0; i < numPlayers; i++) {
      const id = reader.readUint32();
      const lastSequence = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const vx = reader.readFloat32();
      const vy = reader.readFloat32();
      const angle = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const tankClass = reader.readString() as TankClass;
      const name = reader.readString();
      const health = reader.readFloat32();
      const maxHealth = reader.readFloat32();
      const level = reader.readUint16();
      const xp = reader.readFloat32();
      const skillPoints = reader.readUint16();
      
      const stats = {
        healthRegen: reader.readUint8(),
        maxHealth: reader.readUint8(),
        bodyDamage: reader.readUint8(),
        bulletSpeed: reader.readUint8(),
        bulletPenetration: reader.readUint8(),
        bulletDamage: reader.readUint8(),
        reload: reader.readUint8(),
        movementSpeed: reader.readUint8()
      };

      const numBarrels = reader.readUint8();
      const barrelAngles = [];
      for (let j = 0; j < numBarrels; j++) {
        barrelAngles.push(reader.readFloat32());
      }
      
      currentPlayers.add(id);
      let p = this.players.get(id);
      if (!p) {
        p = new Player(new Vector(x, y));
        p.id = id;
        this.players.set(id, p);
      }
      p.name = name;

      if (id === this.myPlayerId) {
        this.lastServerPos = new Vector(x, y);
        this.lastServerVel = new Vector(vx, vy);
        
        // Reconciliation
        const dist = p.pos.dist(this.lastServerPos);
        if (dist > 100) {
          p.pos = this.lastServerPos.copy();
        } else {
          // Hitbox-Biased Smoothing
          const bias = Math.min(1, dist / Math.max(1, p.radius * 0.5));
          p.pos = p.pos.lerp(this.lastServerPos, Math.max(0.2, bias));
        }
        p.vel = this.lastServerVel.copy();
        
        this.pendingInputs = this.pendingInputs.filter(input => input.sequence > lastSequence);
        for (const input of this.pendingInputs) {
          this.applyInput(p, input, input.dt);
        }
      } else {
        p.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
        if (p.stateBuffer.length > 20) p.stateBuffer.shift();
      }

      p.angle = angle;
      p.radius = radius;
      p.color = color;
      p.tankClass = tankClass;
      // Always update health from server to avoid flickering
      p.health = health;
      p.maxHealth = maxHealth;
      p.level = level;
      p.xp = xp;
      p.xpNeeded = Math.floor(100 * Math.pow(level, 1.5));
      p.skillPoints = skillPoints;
      p.stats = stats;
      p.barrelAngles = barrelAngles;
      p.checkUpgrades();
    }

    // Remove dead players
    for (const id of this.players.keys()) {
      if (!currentPlayers.has(id)) {
        this.players.delete(id);
      }
    }

    // Bullets
    const numBullets = reader.readUint16();
    const currentBulletIds = new Set<number>();
    for (let i = 0; i < numBullets; i++) {
      const id = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const flags = reader.readUint8();
      const isRailgun = (flags & 1) !== 0;
      const isDead = (flags & 2) !== 0;
      const hasAutoTurret = (flags & 4) !== 0;
      const missileType = reader.readString() as MissileType;
      let autoAngle = 0;
      if (hasAutoTurret) {
        autoAngle = reader.readFloat32();
      }
      const angle = reader.readFloat32();
      
      currentBulletIds.add(id);
      let b = this.bulletMap.get(id);
      if (!b) {
        b = new Bullet(new Vector(x, y), new Vector(0, 0), -1, 0, 0, radius, color, isRailgun);
        b.id = id;
        this.bulletMap.set(id, b);
      }
      
      if (!isDead) {
        b.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
        if (b.stateBuffer.length > 20) b.stateBuffer.shift();
      }
      
      b.pos.x = x;
      b.pos.y = y;
      b.radius = radius;
      b.color = color;
      b.isRailgun = isRailgun;
      b.dead = isDead;
      b.hasAutoTurret = hasAutoTurret;
      b.missileType = missileType;
      b.autoAngle = autoAngle;
      b.angle = angle;
    }
    for (const id of this.bulletMap.keys()) {
      if (!currentBulletIds.has(id)) this.bulletMap.delete(id);
    }
    this.bullets = Array.from(this.bulletMap.values());

    // Shapes
    const numShapes = reader.readUint16();
    const currentShapeIds = new Set<number>();
    for (let i = 0; i < numShapes; i++) {
      const id = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const shapeType = reader.readUint8();
      const angle = reader.readFloat32();
      const health = reader.readFloat32();
      const maxHealth = reader.readFloat32();
      
      currentShapeIds.add(id);
      let s = this.shapeMap.get(id);
      if (!s) {
        s = new Shape(new Vector(x, y), shapeType, false);
        s.id = id;
        this.shapeMap.set(id, s);
      }
      s.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
      if (s.stateBuffer.length > 20) s.stateBuffer.shift();
      
      s.pos.x = x;
      s.pos.y = y;
      s.radius = radius;
      s.color = color;
      s.angle = angle;
      s.health = health;
      s.maxHealth = maxHealth;
    }
    for (const id of this.shapeMap.keys()) {
      const s = this.shapeMap.get(id);
      // Don't delete rocks just because they are culled by server
      if (s && s.shapeType === ShapeType.ROCK) continue;
      if (!currentShapeIds.has(id)) this.shapeMap.delete(id);
    }
    this.shapes = Array.from(this.shapeMap.values());

    // Enemies
    const numEnemies = reader.readUint16();
    const currentEnemyIds = new Set<number>();
    for (let i = 0; i < numEnemies; i++) {
      const id = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const angle = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const tankClass = reader.readString() as TankClass;
      const name = reader.readString();
      const health = reader.readFloat32();
      const maxHealth = reader.readFloat32();
      
      const numBarrels = reader.readUint8();
      const barrelAngles = [];
      for (let j = 0; j < numBarrels; j++) {
        barrelAngles.push(reader.readFloat32());
      }

      currentEnemyIds.add(id);
      let e = this.enemyMap.get(id);
      if (!e || e.tankClass !== tankClass) {
        e = new EnemyTank(new Vector(x, y), tankClass, 1);
        e.id = id;
        this.enemyMap.set(id, e);
      }
      e.name = name;
      
      e.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
      if (e.stateBuffer.length > 20) e.stateBuffer.shift();
      
      e.angle = angle;
      e.radius = radius;
      e.color = color;
      e.health = health;
      e.maxHealth = maxHealth;
      e.barrelAngles = barrelAngles;
    }
    for (const id of this.enemyMap.keys()) {
      if (!currentEnemyIds.has(id)) this.enemyMap.delete(id);
    }
    this.enemies = Array.from(this.enemyMap.values());

    // Traps
    const numTraps = reader.readUint16();
    const currentTrapIds = new Set<number>();
    for (let i = 0; i < numTraps; i++) {
      const id = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const angle = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const flags = reader.readUint8();
      const hasAutoTurret = (flags & 1) !== 0;
      const missileType = reader.readString() as MissileType;
      let autoAngle = 0;
      if (hasAutoTurret) {
        autoAngle = reader.readFloat32();
      }
      
      currentTrapIds.add(id);
      let t = this.trapMap.get(id);
      if (!t) {
        t = new Trap(new Vector(x, y), new Vector(0, 0), -1, color, 0, 0, radius);
        t.id = id;
        this.trapMap.set(id, t);
      }
      t.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
      if (t.stateBuffer.length > 20) t.stateBuffer.shift();
      
      t.pos.x = x;
      t.pos.y = y;
      t.angle = angle;
      t.radius = radius;
      t.color = color;
      t.hasAutoTurret = hasAutoTurret;
      t.missileType = missileType;
      t.autoAngle = autoAngle;
    }
    for (const id of this.trapMap.keys()) {
      if (!currentTrapIds.has(id)) this.trapMap.delete(id);
    }
    this.traps = Array.from(this.trapMap.values());

    // Drones
    const numDrones = reader.readUint16();
    const currentDroneIds = new Set<number>();
    for (let i = 0; i < numDrones; i++) {
      const id = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const angle = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const flags = reader.readUint8();
      const hasAutoTurret = (flags & 1) !== 0;
      const missileType = reader.readString() as MissileType;
      let autoAngle = 0;
      if (hasAutoTurret) {
        autoAngle = reader.readFloat32();
      }
      
      currentDroneIds.add(id);
      let d = this.droneMap.get(id);
      if (!d) {
        d = new Drone(new Vector(x, y), new Vector(0, 0), -1, color, 0, 0, radius, 0, false);
        d.id = id;
        this.droneMap.set(id, d);
      }
      d.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
      if (d.stateBuffer.length > 20) d.stateBuffer.shift();
      
      d.pos.x = x;
      d.pos.y = y;
      d.angle = angle;
      d.radius = radius;
      d.color = color;
      d.hasAutoTurret = hasAutoTurret;
      d.missileType = missileType;
      d.autoAngle = autoAngle;
    }
    for (const id of this.droneMap.keys()) {
      if (!currentDroneIds.has(id)) this.droneMap.delete(id);
    }
    this.drones = Array.from(this.droneMap.values());

    // Crashers
    const numCrashers = reader.readUint16();
    const currentCrasherIds = new Set<number>();
    for (let i = 0; i < numCrashers; i++) {
      const id = reader.readUint32();
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const angle = reader.readFloat32();
      const radius = reader.readFloat32();
      const color = reader.readString();
      const health = reader.readFloat32();
      const maxHealth = reader.readFloat32();
      
      currentCrasherIds.add(id);
      let c = this.crasherMap.get(id);
      if (!c) {
        c = new Crasher(new Vector(x, y));
        c.id = id;
        this.crasherMap.set(id, c);
      }
      c.stateBuffer.push({ pos: new Vector(x, y), angle, timestamp });
      if (c.stateBuffer.length > 20) c.stateBuffer.shift();
      
      c.pos.x = x;
      c.pos.y = y;
      c.angle = angle;
      c.radius = radius;
      c.color = color;
      c.health = health;
      c.maxHealth = maxHealth;
    }
    for (const id of this.crasherMap.keys()) {
      if (!currentCrasherIds.has(id)) this.crasherMap.delete(id);
    }
    this.crashers = Array.from(this.crasherMap.values());

    // Leaderboard
    const numLeaderboard = reader.readUint8();
    this.leaderboard = [];
    for (let i = 0; i < numLeaderboard; i++) {
      const name = reader.readString();
      const score = reader.readFloat32();
      const id = reader.readUint32();
      this.leaderboard.push({
        name,
        score,
        isPlayer: id === this.myPlayerId
      });
    }
  }

  sendInput(dt: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.sequenceNumber++;
    const input = {
      sequence: this.sequenceNumber,
      dt: dt,
      keys: { ...this.keys },
      mousePos: this.mousePos.copy(),
      mouseDown: this.mouseDown,
      autoFire: this.autoFire,
      autoSpin: this.player?.autoSpin || false
    };
    
    // Mobile joystick overrides
    if (this.isMobile && this.leftJoystick.active) {
      const dir = this.leftJoystick.currentPos.sub(this.leftJoystick.startPos).normalize();
      input.keys['w'] = dir.y < -0.3;
      input.keys['s'] = dir.y > 0.3;
      input.keys['a'] = dir.x < -0.3;
      input.keys['d'] = dir.x > 0.3;
    }

    this.pendingInputs.push(input);

    const writer = new BinaryWriter();
    writer.writeUint8(1); // INPUT
    writer.writeUint32(input.sequence);
    writer.writeUint8(input.keys['w'] || input.keys['arrowup'] ? 1 : 0);
    writer.writeUint8(input.keys['a'] || input.keys['arrowleft'] ? 1 : 0);
    writer.writeUint8(input.keys['s'] || input.keys['arrowdown'] ? 1 : 0);
    writer.writeUint8(input.keys['d'] || input.keys['arrowright'] ? 1 : 0);
    
    // Mouse Pos
    const fovMult = this.player ? getFovMult(this.player.tankClass) : 1;
    const baseScale = Math.min(this.width / 1920, this.height / 1080);
    let ratioScale = 1;
    const ratio = this.width / this.height;
    if (this.isMobile) {
      if (ratio < 1) ratioScale = 0.6;
      else ratioScale = 0.8;
    }
    const scale = baseScale * 1.5 / fovMult * ratioScale;

    const worldMouse = new Vector(
      (input.mousePos.x - this.width / 2) / scale + this.camera.x,
      (input.mousePos.y - this.height / 2) / scale + this.camera.y
    );
    writer.writeFloat32(worldMouse.x);
    writer.writeFloat32(worldMouse.y);
    
    writer.writeUint8(input.mouseDown ? 1 : 0);
    writer.writeUint8(input.autoFire ? 1 : 0);
    writer.writeUint8(input.autoSpin ? 1 : 0);
    
    this.ws.send(writer.getBuffer());
  }

  applyInput(player: Player, input: any, dt: number) {
    const speed = 200 + getEffectiveStat(player.stats.movementSpeed) * 12;
    const accel = speed * 3.0;
    
    if (input.keys['w'] || input.keys['arrowup']) player.vel.y -= accel * dt;
    if (input.keys['s'] || input.keys['arrowdown']) player.vel.y += accel * dt;
    if (input.keys['a'] || input.keys['arrowleft']) player.vel.x -= accel * dt;
    if (input.keys['d'] || input.keys['arrowright']) player.vel.x += accel * dt;
    
    player.update(dt);
    this.applySoftBorder(player, dt);
  }

  constructor(canvas?: HTMLCanvasElement, isServer: boolean = false) {
    this.isServer = isServer;
    if (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d')!;
      this.width = canvas.width;
      this.height = canvas.height;
      this.setupInputs();
    } else {
      this.canvas = null as any;
      this.ctx = null as any;
      this.width = 0;
      this.height = 0;
    }
    
    if (this.isServer) {
      this.initShapes();
      this.initEnemies();
    }
  }

  initShapes() {
    for (let i = 0; i < 1350; i++) {
      this.spawnShape();
    }
    this.initRocks();
  }

  initRocks() {
    for (let i = 0; i < 15; i++) this.spawnRock('outskirts', i, 15);
    for (let i = 0; i < 30; i++) this.spawnRock('nest_pentagon', i, 30);
    for (let i = 0; i < 20; i++) this.spawnRock('nest_hexagon', i, 20);
    for (let i = 0; i < 10; i++) this.spawnRock('nest_heptagon', i, 10);
    for (let i = 0; i < 5; i++) this.spawnRock('random', i, 5);
  }

  isInsideRock(pos: Vector): boolean {
    for (const s of this.shapes) {
      if (s.shapeType === ShapeType.ROCK && s.pos.dist(pos) < s.radius + 50) {
        return true;
      }
    }
    return false;
  }

  spawnRock(zone: 'outskirts' | 'nest_pentagon' | 'nest_hexagon' | 'nest_heptagon' | 'random', index?: number, total?: number) {
    const nestCenter = new Vector(this.worldSize.width / 2, this.worldSize.height / 2);
    let pos: Vector;
    
    if (zone.startsWith('nest_')) {
      const angle = (index !== undefined && total !== undefined) 
        ? (index / total) * Math.PI * 2 + (Math.random() * 0.2 - 0.1)
        : Math.random() * Math.PI * 2;
        
      let r = 0;
      if (zone === 'nest_pentagon') r = 2250 + (Math.random() * 60 - 30);
      else if (zone === 'nest_hexagon') r = 1200 + (Math.random() * 60 - 30);
      else if (zone === 'nest_heptagon') r = 500 + (Math.random() * 60 - 30);
      pos = new Vector(nestCenter.x + Math.cos(angle) * r, nestCenter.y + Math.sin(angle) * r);
    } else if (zone === 'outskirts') {
      const side = Math.floor(Math.random() * 4);
      const margin = 1000;
      if (side === 0) pos = new Vector(Math.random() * margin, Math.random() * this.worldSize.height);
      else if (side === 1) pos = new Vector(this.worldSize.width - Math.random() * margin, Math.random() * this.worldSize.height);
      else if (side === 2) pos = new Vector(Math.random() * this.worldSize.width, Math.random() * margin);
      else pos = new Vector(Math.random() * this.worldSize.width, this.worldSize.height - Math.random() * margin);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const r = 1500 + Math.random() * 2500;
      pos = new Vector(nestCenter.x + Math.cos(angle) * r, nestCenter.y + Math.sin(angle) * r);
    }

    const rockRand = Math.random();
    let sizeMult = 2.5;
    if (rockRand > 0.5) sizeMult = 5;
    
    this.shapes.push(new Shape(pos, ShapeType.ROCK, false, sizeMult));
  }

  maintainRocks() {
    if (!this.isServer) return;
    
    const nestCenter = new Vector(this.worldSize.width / 2, this.worldSize.height / 2);
    let pentagonCount = 0;
    let hexagonCount = 0;
    let heptagonCount = 0;
    let outskirtsCount = 0;
    let randomCount = 0;

    for (const s of this.shapes) {
      if (s.shapeType === ShapeType.ROCK) {
        const d = s.pos.dist(nestCenter);
        const isOutskirts = s.pos.x < 1000 || s.pos.x > this.worldSize.width - 1000 || s.pos.y < 1000 || s.pos.y > this.worldSize.height - 1000;
        
        if (Math.abs(d - 2250) < 150) pentagonCount++;
        else if (Math.abs(d - 1200) < 150) hexagonCount++;
        else if (Math.abs(d - 500) < 150) heptagonCount++;
        else if (isOutskirts) outskirtsCount++;
        else randomCount++;
      }
    }

    if (pentagonCount < 30) this.spawnRock('nest_pentagon');
    if (hexagonCount < 20) this.spawnRock('nest_hexagon');
    if (heptagonCount < 10) this.spawnRock('nest_heptagon');
    if (outskirtsCount < 15) this.spawnRock('outskirts');
    if (randomCount < 5) this.spawnRock('random');
  }

  initEnemies() {
    for (let i = 0; i < 15; i++) {
      this.spawnEnemyTank();
    }
  }

  spawnCrasher() {
    const nestRadius = 2250;
    const nestCenter = new Vector(this.worldSize.width / 2, this.worldSize.height / 2);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * nestRadius;
    const pos = new Vector(nestCenter.x + Math.cos(angle) * r, nestCenter.y + Math.sin(angle) * r);
    
    if (this.isInsideRock(pos)) return;
    
    let type = CrasherType.SMALL;
    if (Math.random() < 0.1) {
      type = CrasherType.LIGHTNING;
    } else if (r < 500) {
      type = CrasherType.LARGE;
    } else if (r < 1200) {
      type = CrasherType.MEDIUM;
    }
    
    this.crashers.push(new Crasher(pos, type));
  }

  spawnEnemyTank() {
    const pos = new Vector(Math.random() * this.worldSize.width, Math.random() * this.worldSize.height);
    // Don't spawn too close to player
    if (this.player && pos.dist(this.player.pos) < 1000) {
      this.spawnEnemyTank();
      return;
    }
    
    const tankClass = TankClass.Basic;
    const levels = [15, 30, 45];
    const level = levels[Math.floor(Math.random() * levels.length)];
    this.enemies.push(new EnemyTank(pos, tankClass, level));
  }

  spawnShape() {
    let type: ShapeType;
    let pos: Vector;
    let isAlpha = Math.random() < 0.04;
    let sizeMult = 1;

    const nestRadius = 2250;
    const nestCenter = new Vector(this.worldSize.width / 2, this.worldSize.height / 2);

    if (Math.random() < 0.08) {
      // Spawn in nest
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * nestRadius;
      pos = new Vector(nestCenter.x + Math.cos(angle) * r, nestCenter.y + Math.sin(angle) * r);
      
      if (r < 500) {
        // Heptagon Nest
        if (Math.random() < 0.05) {
            type = ShapeType.HEPTAGON;
            isAlpha = true;
        } else {
            const rand = Math.random();
            if (rand < 0.5) type = ShapeType.PENTAGON;
            else if (rand < 0.75) type = ShapeType.HEXAGON;
            else type = ShapeType.HEPTAGON;
        }
      } else if (r < 1200) {
        // Hexagon Nest
        if (Math.random() < 0.05) {
            type = ShapeType.HEXAGON;
            isAlpha = true;
        } else {
            const rand = Math.random();
            if (rand < 0.5) type = ShapeType.PENTAGON;
            else type = ShapeType.HEXAGON;
        }
      } else {
        // Pentagon Nest
        if (Math.random() < 0.05) {
            type = ShapeType.PENTAGON;
            isAlpha = true;
        } else {
            type = ShapeType.PENTAGON;
        }
      }
    } else {
      // Spawn anywhere
      pos = new Vector(Math.random() * this.worldSize.width, Math.random() * this.worldSize.height);
      const rand = Math.random();
      if (rand > 0.995) type = ShapeType.HEXAGON;
      else if (rand > 0.975) type = ShapeType.PENTAGON;
      else if (rand > 0.7) type = ShapeType.TRIANGLE;
      else type = ShapeType.SQUARE;
    }
    
    if (this.isInsideRock(pos)) return;
    
    this.shapes.push(new Shape(pos, type, isAlpha, sizeMult));
  }

  setupInputs() {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      this.keys[e.key.toLowerCase()] = true;
      
      // Tab+R Force Sync
      if (this.keys['tab'] && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.forceSync();
      }

      if (e.key.toLowerCase() === 'e') {
        this.autoFire = !this.autoFire;
      }
      if (e.key.toLowerCase() === 'c') {
        if (this.player) {
          this.player.autoSpin = !this.player.autoSpin;
        }
      }
      if (e.key.toLowerCase() === 'n') {
        if (this.player) {
          const nextLevelExp = 100 * Math.pow(this.player.level, 1.5);
          this.player.gainXp(nextLevelExp - this.player.xp);
        }
      }
      if (e.key.toLowerCase() === 'o') {
        if (this.player) this.player.takeDamage(this.player.health);
      }
      if (e.key.toLowerCase() === 'h') {
        this.requestSync();
      }
      if (e.key >= '1' && e.key <= '8') {
        const statKeys = ['healthRegen', 'maxHealth', 'bodyDamage', 'bulletSpeed', 'bulletPenetration', 'bulletDamage', 'reload', 'movementSpeed'];
        const index = parseInt(e.key) - 1;
        this.upgradeStat(statKeys[index] as any);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      this.keys[e.key.toLowerCase()] = false;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos = new Vector(e.clientX - rect.left, e.clientY - rect.top);
    };
    
    const handleMouseDown = () => this.mouseDown = true;
    const handleMouseUp = () => this.mouseDown = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      this.isMobile = true;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const touchPos = new Vector(touchX, touchY);
        
        if (touchX < this.width / 2) {
          if (!this.leftJoystick.active) {
            this.leftJoystick.active = true;
            this.leftJoystick.startPos = touchPos;
            this.leftJoystick.currentPos = touchPos;
            this.leftJoystick.touchId = touch.identifier;
          }
        } else {
          if (!this.rightJoystick.active) {
            this.rightJoystick.active = true;
            this.rightJoystick.startPos = touchPos;
            this.rightJoystick.currentPos = touchPos;
            this.rightJoystick.touchId = touch.identifier;
            this.mouseDown = true;
          }
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = this.canvas.getBoundingClientRect();
        const touchPos = new Vector(touch.clientX - rect.left, touch.clientY - rect.top);
        
        if (touch.identifier === this.leftJoystick.touchId) {
          this.leftJoystick.currentPos = touchPos;
        } else if (touch.identifier === this.rightJoystick.touchId) {
          this.rightJoystick.currentPos = touchPos;
          this.mousePos = touchPos;
        }
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.leftJoystick.touchId) {
          this.leftJoystick.active = false;
          this.leftJoystick.touchId = null;
        } else if (touch.identifier === this.rightJoystick.touchId) {
          this.rightJoystick.active = false;
          this.rightJoystick.touchId = null;
          this.mouseDown = false;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    this.canvas.addEventListener('mousemove', handleMouseMove);
    this.canvas.addEventListener('mousedown', handleMouseDown);
    this.canvas.addEventListener('mouseup', handleMouseUp);
    this.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', handleTouchEnd);
    this.canvas.addEventListener('touchcancel', handleTouchEnd);

    // Store cleanup function
    this.cleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      this.canvas.removeEventListener('mousemove', handleMouseMove);
      this.canvas.removeEventListener('mousedown', handleMouseDown);
      this.canvas.removeEventListener('mouseup', handleMouseUp);
      this.canvas.removeEventListener('touchstart', handleTouchStart);
      this.canvas.removeEventListener('touchmove', handleTouchMove);
      this.canvas.removeEventListener('touchend', handleTouchEnd);
      this.canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }
  
  cleanup: () => void = () => {};

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrameId);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
    
    // Clear all entities
    this.players.clear();
    this.bullets = [];
    this.traps = [];
    this.drones = [];
    this.shapes = [];
    this.crashers = [];
    this.enemies = [];
    this.bulletMap.clear();
    this.trapMap.clear();
    this.droneMap.clear();
    this.shapeMap.clear();
    this.crasherMap.clear();
    this.enemyMap.clear();
    this.inputs.clear();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  loop(time: number) {
    let frameTime = (time - this.lastTime) / 1000;
    if (frameTime > 0.25) frameTime = 0.25;
    this.lastTime = time;
    
    this.accumulator += frameTime;
    
    // Fast-forward or slow-down to match server time
    // We want localServerTime to be roughly serverTime - 100ms
    const targetTime = this.serverTime - 100;
    const diff = targetTime - this.localServerTime;
    
    if (diff > 20) {
      // Quadratically increasing speedup based on how far behind we are
      const factor = Math.min(5.0, Math.pow(diff / 100, 2) * 0.5);
      this.accumulator += frameTime * factor;
    } else if (diff < -20) {
      // Slow down if too far ahead
      const factor = Math.min(0.8, Math.pow(-diff / 100, 2) * 0.2);
      this.accumulator -= frameTime * factor;
    }

    while (this.accumulator >= this.fixedDt) {
      this.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }
    
    this.draw();
    
    if (this.running) {
      this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  private tickEntityWeapons(entity: Bullet | Trap | Drone, dt: number) {
    if (!this.isServer || entity.dead) return;

    let barrels: BarrelDef[] = [];
    if (entity.missileType !== MissileType.None) {
      barrels = barrels.concat(getMissileBarrels(entity.missileType));
    }
    if (entity.hasAutoTurret) {
      barrels.push(AUTO_TURRET_BARREL);
    }

    if (barrels.length === 0) return;

    // Initialize reload timers if needed
    if (entity.reloadTimers.length !== barrels.length) {
      entity.reloadTimers = new Array(barrels.length).fill(0);
    }

    // Find target for auto aim
    let target: Entity | null = null;
    let minDistSq = Infinity;
    const isAutoAim = barrels.some(b => b.autoAim);
    
    if (isAutoAim) {
      const targets: Entity[] = [];
      for (const p of this.players.values()) {
        if (p.id !== entity.ownerId) targets.push(p);
      }
      for (const e of this.enemies) {
        if (e.id !== entity.ownerId) targets.push(e);
      }
      for (const s of this.shapes) targets.push(s);
      
      for (const t of targets) {
        const distSq = entity.pos.distSq(t.pos);
        if (distSq < 600 * 600 && distSq < minDistSq) {
          minDistSq = distSq;
          target = t;
        }
      }
    }

    if (target) {
      const targetAngle = Math.atan2(target.pos.y - entity.pos.y, target.pos.x - entity.pos.x);
      // Smoothly rotate autoAngle towards targetAngle
      let diff = targetAngle - entity.autoAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      entity.autoAngle += diff * Math.min(1, dt * 10);
    } else {
      entity.autoAngle += dt * 2; // Spin when no target
    }

    const owner = this.players.get(entity.ownerId) || this.enemies.find(e => e.id === entity.ownerId);
    if (!owner) return;

    const baseReloadTime = 1.0; // Base reload time for entity weapons
    const bulletSpeed = 400;

    for (let i = 0; i < barrels.length; i++) {
      const barrel = barrels[i];
      const reloadTime = baseReloadTime * barrel.reloadMult;
      
      entity.reloadTimers[i] += dt;
      
      let canShoot = false;
      if (barrel.autoAim) {
        canShoot = target !== null && entity.reloadTimers[i] >= reloadTime;
      } else {
        canShoot = entity.reloadTimers[i] >= reloadTime;
      }

      if (canShoot) {
        entity.reloadTimers[i] -= reloadTime;
        
        const baseAngle = barrel.autoAim ? entity.autoAngle : entity.angle;
        const barrelAngle = baseAngle + barrel.angleOffset;
        const dir = new Vector(Math.cos(barrelAngle), Math.sin(barrelAngle));
        
        const bForward = new Vector(Math.cos(barrelAngle), Math.sin(barrelAngle));
        const bRight = new Vector(-bForward.y, bForward.x);
        let spawnPos = entity.pos.add(bForward.mult(barrel.length)).add(bRight.mult(barrel.yOffset));
        
        const angle = barrelAngle + (Math.random() - 0.5) * barrel.spread;
        const vel = new Vector(Math.cos(angle), Math.sin(angle)).mult(bulletSpeed * barrel.speedMult);
        
        const bulletDamage = entity.damage * barrel.damageMult;
        const bulletPenetration = entity.penetration * barrel.penMult;
        const bulletRadius = 8 * (barrel.bulletSizeMult || 1);

        if (barrel.type === 'trap') {
          const t = new Trap(spawnPos, vel, entity.ownerId, entity.color, bulletDamage, bulletPenetration, bulletRadius * 1.5, entity.ownerClass);
          t.hasAutoTurret = barrel.hasAutoTurret || false;
          t.missileType = barrel.missileType || MissileType.None;
          this.traps.push(t);
        } else if (barrel.type === 'drone' || barrel.type === 'cruiser_drone') {
          const isCruiser = barrel.type === 'cruiser_drone';
          const dSpeed = isCruiser ? bulletSpeed * 0.6 : bulletSpeed * 0.3;
          const dRadius = isCruiser ? bulletRadius * 1.2 : bulletRadius * 1.8;
          const dPenetration = isCruiser ? 1 : bulletPenetration;
          const dDamage = isCruiser ? bulletDamage * 0.25 : bulletDamage;
          const d = new Drone(spawnPos, vel, entity.ownerId, entity.color, dDamage, dPenetration, dRadius, dSpeed, isCruiser, entity.ownerClass);
          d.hasAutoTurret = barrel.hasAutoTurret || false;
          d.missileType = barrel.missileType || MissileType.None;
          this.drones.push(d);
        } else {
          const b = new Bullet(spawnPos, vel, entity.ownerId, bulletDamage, bulletPenetration, bulletRadius, entity.color, false, entity.ownerClass);
          b.hasAutoTurret = barrel.hasAutoTurret || false;
          b.missileType = barrel.missileType || MissileType.None;
          this.bullets.push(b);
        }
        
        const recoil = barrel.recoilMult !== undefined ? barrel.recoilMult : barrel.damageMult;
        entity.vel = entity.vel.sub(dir.mult(10 * recoil));
      }
    }
  }

  update(dt: number) {
    if (!this.isServer) {
      this.localServerTime += dt * 1000;
      
      this.sendInput(dt);

      if (this.isSpawning && !this.player) {
        this.spawnRetryTimer += dt;
        if (this.spawnRetryTimer > 1.0) {
          this.spawnRetryTimer = 0;
          this.spawnRetryCount++;
          if (this.spawnRetryCount >= 8) {
            console.log('Spawn failed 8 times, reconnecting...');
            this.spawnRetryCount = 0;
            if (this.ws) {
              this.ws.close();
            }
            this.connect();
          } else {
            console.log('Retrying spawn...');
            this.spawn(this.spawnName, 1);
          }
        }
      } else if (this.player) {
        this.isSpawning = false;
        this.spawnRetryTimer = 0;
        this.spawnRetryCount = 0;
        
        // Client-side prediction for local player
        const p = this.player;
        const currentInput = {
          keys: { ...this.keys },
          mousePos: this.mousePos.copy(),
          mouseDown: this.mouseDown,
          autoFire: this.autoFire
        };
        
        // Mobile joystick overrides
        if (this.isMobile && this.leftJoystick.active) {
          const dir = this.leftJoystick.currentPos.sub(this.leftJoystick.startPos).normalize();
          currentInput.keys['w'] = dir.y < -0.3;
          currentInput.keys['s'] = dir.y > 0.3;
          currentInput.keys['a'] = dir.x < -0.3;
          currentInput.keys['d'] = dir.x > 0.3;
        }

        this.applyInput(p, currentInput, dt);

        // Desync detection
        if (this.lastServerPos) {
          const dist = p.pos.dist(this.lastServerPos);
          if (dist > 100) {
            this.desyncTimer += dt;
            if (this.desyncTimer > 2.0) { // If off-sync for more than 2 seconds
              this.requestSync();
              this.desyncTimer = 0;
            }
          } else {
            this.desyncTimer = 0;
          }
        }
      }

      if (this.player && !this.player.dead) {
        // Always follow the player
        this.camera.x += (this.player.pos.x - this.camera.x) * 10 * dt;
        this.camera.y += (this.player.pos.y - this.camera.y) * 10 * dt;
      }
      
      if (this.onStateChange) {
        this.onStateChange({
          level: this.player?.level || 1,
          xp: this.player?.xp || 0,
          xpNeeded: this.player?.xpNeeded || 100,
          skillPoints: this.player?.skillPoints || 0,
          stats: this.player?.stats || {
            healthRegen: 0,
            maxHealth: 0,
            bodyDamage: 0,
            bulletSpeed: 0,
            bulletPenetration: 0,
            bulletDamage: 0,
            reload: 0,
            movementSpeed: 0
          },
          health: this.player?.health || 0,
          maxHealth: this.player?.maxHealth || 0,
          autoFire: this.autoFire,
          autoSpin: this.player?.autoSpin || false,
          tankClass: this.player?.tankClass || TankClass.Basic,
          pendingUpgrades: this.player?.pendingUpgrades || [],
          isSpawned: !!this.player,
          leaderboard: this.leaderboard
        });
      }
      return;
    }

    // Update players
    for (const [playerId, player] of this.players.entries()) {
      const input = this.inputs.get(playerId) || { keys: {}, mousePos: new Vector(0, 0), mouseDown: false, autoFire: false };
      
      if (player.classChanged) {
        this.drones = this.drones.filter(d => d.ownerId !== player.id);
        player.classChanged = false;
      }

      const speed = 200 + getEffectiveStat(player.stats.movementSpeed) * 12;
      const accel = speed * 3.0;
      
      if (input.keys['w'] || input.keys['arrowup']) player.vel.y -= accel * dt;
      if (input.keys['s'] || input.keys['arrowdown']) player.vel.y += accel * dt;
      if (input.keys['a'] || input.keys['arrowleft']) player.vel.x -= accel * dt;
      if (input.keys['d'] || input.keys['arrowright']) player.vel.x += accel * dt;

      // Player aiming
      if (!player.autoSpin) {
        player.angle = Math.atan2(input.mousePos.y - player.pos.y, input.mousePos.x - player.pos.x);
      }
      player.update(dt);

      const isShooting = input.mouseDown || input.autoFire;
      player.shooting = isShooting;
      const barrels = TANK_CLASSES[player.tankClass];
      const baseReloadTime = Math.max(0.05, Math.pow(0.9, getEffectiveStat(player.stats.reload)));
      
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
          
          const barrelBaseAngle = player.angle + (barrel.posAngle !== undefined ? barrel.posAngle : barrel.angleOffset);

          const targets: (Entity)[] = [...this.shapes, ...this.enemies, ...this.crashers, ...Array.from(this.players.values())];
          for (const s of targets) {
            if (s.dead || s.id === player.id) continue;
            if ('shapeType' in s && (s as any).shapeType === ShapeType.ROCK) continue;
            
            const angleToTarget = Math.atan2(s.pos.y - spawnPos.y, s.pos.x - spawnPos.x);
            const angleDiffFromBase = Math.atan2(Math.sin(angleToTarget - barrelBaseAngle), Math.cos(angleToTarget - barrelBaseAngle));
            
            if (Math.abs(angleDiffFromBase) > Math.PI / 2) continue; // 180 degree FOV (90 degrees each side)

            const dist = spawnPos.dist(s.pos);
            if (dist < minDist) {
              minDist = dist;
              nearestShape = s;
            }
          }
          
          if (nearestShape) {
            const targetAngle = Math.atan2(nearestShape.pos.y - spawnPos.y, nearestShape.pos.x - spawnPos.x);
            const bAngleDiff = targetAngle - (player.barrelAngles[i] ?? barrelBaseAngle);
            const bShortestDiff = Math.atan2(Math.sin(bAngleDiff), Math.cos(bAngleDiff));
            
            // Smooth rotation
            player.barrelAngles[i] = (player.barrelAngles[i] ?? barrelBaseAngle) + bShortestDiff * 10 * dt;
            
            // Clamp to 180 degree limit relative to tank rotation
            const finalAngleDiff = Math.atan2(Math.sin(player.barrelAngles[i] - barrelBaseAngle), Math.cos(player.barrelAngles[i] - barrelBaseAngle));
            if (Math.abs(finalAngleDiff) > Math.PI / 2) {
              player.barrelAngles[i] = barrelBaseAngle + (finalAngleDiff > 0 ? Math.PI / 2 : -Math.PI / 2);
            }
            
            barrelAngle = player.barrelAngles[i];
            barrelShooting = true;
          } else {
            barrelShooting = false;
            // Return to home position
            const bAngleDiff = barrelBaseAngle - (player.barrelAngles[i] ?? barrelBaseAngle);
            const bShortestDiff = Math.atan2(Math.sin(bAngleDiff), Math.cos(bAngleDiff));
            player.barrelAngles[i] = (player.barrelAngles[i] ?? barrelBaseAngle) + bShortestDiff * 5 * dt;
            barrelAngle = player.barrelAngles[i];
          }
        } else {
          player.barrelAngles[i] = barrelAngle;
        }

        if (barrel.visualOnly) {
          barrelShooting = false;
        }

        if (barrelShooting) {
          const reloadTime = baseReloadTime * barrel.reloadMult;
          
          let canFireAtCap = true;
          if (barrel.type === 'drone' || barrel.type === 'cruiser_drone') {
            const isCruiser = barrel.type === 'cruiser_drone';
            const currentCount = isCruiser ? playerCruiserDroneCount : playerDroneCount;
            
            let maxDrones = barrel.maxDrones || 8;
            const isUnderseerClass = player.tankClass === TankClass.Underseer || 
                                     player.tankClass === TankClass.AutoUnderseer ||
                                     player.tankClass === TankClass.Necromancer ||
                                     player.tankClass === TankClass.GreyGoo ||
                                     player.tankClass === TankClass.Lich;
            if (isUnderseerClass && !isCruiser) {
              const reloadPoints = player.stats.reload || 0;
              maxDrones = 8;
              for (let r = 0; r < reloadPoints; r++) {
                if (r < 7) maxDrones += 4;
                else maxDrones += 2;
              }
            }

            if (currentCount >= maxDrones) {
              canFireAtCap = false;
            }
          }

          if (canFireAtCap) {
            player.barrelTimers[i] += dt;
            
            if (player.barrelTimers[i] >= reloadTime) {
              player.barrelTimers[i] -= reloadTime;
              
              const bulletSpeed = (400 + getEffectiveStat(player.stats.bulletSpeed) * 40) * barrel.speedMult;
              const bulletDamage = (750 + getEffectiveStat(player.stats.bulletDamage) * 150) * barrel.damageMult * Math.pow((bulletSpeed / 400),1.5);
              const bulletPenetration = (0.2 + getEffectiveStat(player.stats.bulletPenetration) * 0.05) * barrel.penMult;
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
                 const t = new Trap(spawnPos, vel, player.id, player.color, bulletDamage, bulletPenetration, bulletRadius * 1.5, player.tankClass);
                 t.hasAutoTurret = barrel.hasAutoTurret || false;
                 t.missileType = barrel.missileType || MissileType.None;
                 this.traps.push(t);
              } else if (barrel.type === 'drone' || barrel.type === 'cruiser_drone') {
                 const isCruiser = barrel.type === 'cruiser_drone';
                 const dSpeed = isCruiser ? bulletSpeed * 0.66 : bulletSpeed * 0.33;
                 const dRadius = isCruiser ? bulletRadius * 1.2 : bulletRadius * 1.8;
                 const dPenetration = isCruiser ? 1 : bulletPenetration;
                 const dDamage = isCruiser ? bulletDamage * 0.25 : bulletDamage;
                 const d = new Drone(spawnPos, vel, player.id, player.color, dDamage, dPenetration, dRadius, dSpeed, isCruiser, player.tankClass);
                 d.hasAutoTurret = barrel.hasAutoTurret || false;
                 d.missileType = barrel.missileType || MissileType.None;
                 this.drones.push(d);
                 if (isCruiser) playerCruiserDroneCount++;
                 else playerDroneCount++;
              } else {
                 const b = new Bullet(spawnPos, vel, player.id, bulletDamage, bulletPenetration, bulletRadius, player.color, player.tankClass === TankClass.Railgun, player.tankClass);
                 b.hasAutoTurret = barrel.hasAutoTurret || false;
                 b.missileType = barrel.missileType || MissileType.None;
                 this.bullets.push(b);
              }
              
              const recoil = barrel.recoilMult !== undefined ? barrel.recoilMult : barrel.damageMult;
              player.vel = player.vel.sub(dir.mult(20 * recoil));
            }
          } else {
            // At cap, just keep timer at targetTime (ready to fire)
            const targetTime = reloadTime * (1 - barrel.delay);
            if (player.barrelTimers[i] < targetTime) {
              player.barrelTimers[i] += dt;
              if (player.barrelTimers[i] > targetTime) player.barrelTimers[i] = targetTime;
            }
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
        console.log('Player dead, calling onPlayerDeath', playerId);
        if (playerId === this.myPlayerId) {
          this.killerId = player.lastDamagedBy;
        }
        if (this.isServer && this.onPlayerDeath) this.onPlayerDeath(playerId, player.lastDamagedBy);
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
      this.tickEntityWeapons(b, dt);
      const margin = 500;
      const isOutOfBounds = b.pos.x < -margin || b.pos.x > this.worldSize.width + margin || b.pos.y < -margin || b.pos.y > this.worldSize.height + margin;
      
      let shouldRemove = false;
      if (isOutOfBounds) {
        shouldRemove = true;
      } else if (b.dead) {
        if (b.isRailgun) {
          if (b.deadTimer >= 1.0) {
            shouldRemove = true;
          }
        } else {
          shouldRemove = true;
        }
      }
      
      if (shouldRemove) {
        this.bullets.splice(i, 1);
        this.bulletMap.delete(b.id);
      }
    }

    // Update traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];

      t.update(dt);
      this.tickEntityWeapons(t, dt);
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
      this.tickEntityWeapons(d, dt);
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
        const wasRock = s.shapeType === ShapeType.ROCK;
        this.shapes.splice(i, 1);
        if (!wasRock) {
          this.spawnShape();
        }
      }
    }

    this.maintainRocks();

    // Update crashers
    if (this.crashers.length < 40) {
      if (Math.random() < 0.1) this.spawnCrasher();
    }
    
    // Reuse arrays for target lists to reduce GC pressure
    this.crasherTargets.length = 0;
    for (const p of this.players.values()) this.crasherTargets.push(p);
    for (const d of this.drones) this.crasherTargets.push(d);
    for (const e of this.enemies) this.crasherTargets.push(e);

    for (let i = this.crashers.length - 1; i >= 0; i--) {
      const c = this.crashers[i];
      c.tick(dt, this.crasherTargets);
      this.applySoftBorder(c, dt);
      if (c.dead) {
        this.crashers.splice(i, 1);
      }
    }

    // Update enemies
    if (this.enemies.length < 15) {
      if (Math.random() < 0.01) this.spawnEnemyTank();
    }
    
    this.enemyTargets.length = 0;
    for (const p of this.players.values()) this.enemyTargets.push(p);
    for (const d of this.drones) this.enemyTargets.push(d);
    for (const s of this.shapes) this.enemyTargets.push(s);
    for (const e of this.enemies) this.enemyTargets.push(e);

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

      e.tick(dt, this.enemyTargets, (type, pos, vel, stats, barrel) => {
        const bulletRadius = 8 * (barrel.bulletSizeMult || 1);
        if (type === 'trap') {
          const t = new Trap(pos, vel, e.id, e.color, stats.bulletDamage, stats.bulletPen, bulletRadius * 1.5, e.tankClass);
          t.hasAutoTurret = barrel.hasAutoTurret || false;
          t.missileType = barrel.missileType || MissileType.None;
          this.traps.push(t);
        } else if (type === 'drone' || type === 'cruiser_drone') {
          const isCruiser = type === 'cruiser_drone';
          const dRadius = isCruiser ? bulletRadius * 1.2 : bulletRadius * 1.8;
          const dSpeed = stats.bulletSpeed * (isCruiser ? 0.66 : 0.33);
          const d = new Drone(pos, vel, e.id, e.color, stats.bulletDamage, stats.bulletPen, dRadius, dSpeed, isCruiser, e.tankClass);
          d.hasAutoTurret = barrel.hasAutoTurret || false;
          d.missileType = barrel.missileType || MissileType.None;
          this.drones.push(d);
        } else {
          const b = new Bullet(pos, vel, e.id, stats.bulletDamage, stats.bulletPen, bulletRadius, e.color, e.tankClass === TankClass.Railgun, e.tankClass);
          b.hasAutoTurret = barrel.hasAutoTurret || false;
          b.missileType = barrel.missileType || MissileType.None;
          this.bullets.push(b);
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

    // Update leaderboard (once per 3 seconds)
    if (this.isServer) {
      const now = Date.now();
      if (now - this.lastLeaderboardUpdate > 3000) {
        this.lastLeaderboardUpdate = now;
        const newLeaderboard = [];
        for (const p of this.players.values()) {
          newLeaderboard.push({ name: p.name, score: calculateTotalXp(p.level, p.xp), isPlayer: false });
        }
        for (const e of this.enemies) {
          newLeaderboard.push({ name: e.name, score: calculateTotalXp(e.level, e.xp), isPlayer: false });
        }
        newLeaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = newLeaderboard.slice(0, 10);
      }
    }

    // Camera follow player smoothly
    if (this.player && !this.player.dead) {
      if (this.camera.dist(this.player.pos) > 2000) {
        this.camera.x = this.player.pos.x;
        this.camera.y = this.player.pos.y;
      } else {
        this.camera.x += (this.player.pos.x - this.camera.x) * 10 * dt;
        this.camera.y += (this.player.pos.y - this.camera.y) * 10 * dt;
      }
    } else if (this.killerId) {
      const killer = this.players.get(this.killerId) || 
                     this.enemies.find(e => e.id === this.killerId) || 
                     this.crashers.find(c => c.id === this.killerId) || 
                     this.shapes.find(s => s.id === this.killerId) ||
                     this.bullets.find(b => b.id === this.killerId) ||
                     this.traps.find(t => t.id === this.killerId) ||
                     this.drones.find(d => d.id === this.killerId);
      if (killer) {
        this.camera.x += (killer.pos.x - this.camera.x) * 10 * dt;
        this.camera.y += (killer.pos.y - this.camera.y) * 10 * dt;
      }
    }
    
    if (this.onStateChange) {
      const state: any = {
        leaderboard: this.leaderboard,
        level: this.player?.level || 1,
        xp: this.player?.xp || 0,
        xpNeeded: this.player?.xpNeeded || 100,
        skillPoints: this.player?.skillPoints || 0,
        stats: this.player?.stats || {
          healthRegen: 0,
          maxHealth: 0,
          bodyDamage: 0,
          bulletSpeed: 0,
          bulletPenetration: 0,
          bulletDamage: 0,
          reload: 0,
          movementSpeed: 0
        },
        health: this.player?.health || 0,
        maxHealth: this.player?.maxHealth || 0,
        autoFire: this.inputs.get(this.myPlayerId!)?.autoFire || false,
        autoSpin: this.inputs.get(this.myPlayerId!)?.autoSpin || false,
        tankClass: this.player?.tankClass || TankClass.Basic,
        pendingUpgrades: this.player?.pendingUpgrades || [],
        isSpawned: !!this.player && !this.player.dead
      };

      this.onStateChange(state);
    }
  }

  applySoftBorder(entity: Entity, dt: number) {
    const forceStrength = 100; // Lower base force
    const quadraticFactor = 0.8; // Quadratic scaling for stronger push further out
    
    let force = new Vector(0, 0);
    
    // X
    if (entity.pos.x < 0) {
      const dist = -entity.pos.x;
      force.x += (dist * forceStrength) + (dist * dist * quadraticFactor);
      // Slow down if moving further out
      if (entity.vel.x < 0) entity.vel.x *= (1 - 2 * dt);
    } else if (entity.pos.x > this.worldSize.width) {
      const dist = entity.pos.x - this.worldSize.width;
      force.x -= (dist * forceStrength) + (dist * dist * quadraticFactor);
      // Slow down if moving further out
      if (entity.vel.x > 0) entity.vel.x *= (1 - 2 * dt);
    }
    
    // Y
    if (entity.pos.y < 0) {
      const dist = -entity.pos.y;
      force.y += (dist * forceStrength) + (dist * dist * quadraticFactor);
      // Slow down if moving further out
      if (entity.vel.y < 0) entity.vel.y *= (1 - 2 * dt);
    } else if (entity.pos.y > this.worldSize.height) {
      const dist = entity.pos.y - this.worldSize.height;
      force.y -= (dist * forceStrength) + (dist * dist * quadraticFactor);
      // Slow down if moving further out
      if (entity.vel.y > 0) entity.vel.y *= (1 - 2 * dt);
    }
    
    // Apply force to velocity
    entity.vel = entity.vel.add(force.mult(dt));
  }

  giveXp(ownerId: number, amount: number) {
    if (this.players.has(ownerId)) {
      this.players.get(ownerId)!.gainXp(amount);
    } else {
      const enemy = this.enemies.find(e => e.id === ownerId);
      if (enemy) enemy.gainXp(amount);
    }
  }

  checkCollisions(dt: number) {
    this.grid.clear();
    for (const p of this.players.values()) this.grid.insert(p);
    for (const b of this.bullets) this.grid.insert(b);
    for (const t of this.traps) this.grid.insert(t);
    for (const d of this.drones) this.grid.insert(d);
    for (const s of this.shapes) this.grid.insert(s);
    for (const c of this.crashers) this.grid.insert(c);
    for (const e of this.enemies) this.grid.insert(e);

    // Shape vs Shape (Rock) collisions
    for (let i = 0; i < this.shapes.length; i++) {
      const s1 = this.shapes[i];
      if (s1.dead) continue;
      const nearby = this.grid.getNearby(s1.pos.x, s1.pos.y, s1.radius + 150);
      for (const s2 of nearby) {
        if (s2 === s1 || s2.dead || !(s2 instanceof Shape)) continue;
        if (s1.shapeType !== ShapeType.ROCK && s2.shapeType !== ShapeType.ROCK) continue;
        
        const dist = s1.pos.dist(s2.pos);
        const minDist = s1.radius + s2.radius;
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const dir = s1.pos.sub(s2.pos).normalize();
          if (s1.shapeType === ShapeType.ROCK && s2.shapeType !== ShapeType.ROCK) {
            s2.pos = s2.pos.sub(dir.mult(overlap));
            s2.vel = s2.vel.sub(dir.mult(100 * dt));
          } else if (s1.shapeType !== ShapeType.ROCK && s2.shapeType === ShapeType.ROCK) {
            s1.pos = s1.pos.add(dir.mult(overlap));
            s1.vel = s1.vel.add(dir.mult(100 * dt));
          }
        }
      }
    }

    // Projectile vs Projectile collisions
    const projectiles = [...this.bullets, ...this.traps, ...this.drones];
    for (let i = 0; i < projectiles.length; i++) {
      const p1 = projectiles[i];
      if (p1.dead) continue;
      const nearby = this.grid.getNearby(p1.pos.x, p1.pos.y, p1.radius + 150);
      for (const p2 of nearby) {
        if (p2.dead || p2 === p1) continue;
        if ((p1 as any).ownerId === (p2 as any).ownerId) continue;
        
        if ((p2 instanceof Bullet || p2 instanceof Trap || p2 instanceof Drone) && p1.pos.dist(p2.pos) < p1.radius + p2.radius) {
          p1.isDamaging = true;
          const divisor = p1 instanceof Trap ? 375 : 750;
          let damageToDeal = p1.damage;
          if (p1 instanceof Bullet && p1.ownerClass === TankClass.Excavator) damageToDeal *= 0.75;
          p2.penetration -= (damageToDeal / divisor) * dt;
        }
      }
    }

    // Bullet collisions
    for (const b of this.bullets) {
      if (b.dead) continue;
      const nearby = this.grid.getNearby(b.pos.x, b.pos.y, b.radius + 150);
      for (const other of nearby) {
        if (other.dead || other === b) continue;
        
        if (other instanceof Shape) {
          const s = other;
          if (b.pos.dist(s.pos) < b.radius + s.radius) {
            b.isDamaging = true;
            let damageToDeal = b.damage * dt;
            if (b.ownerClass === TankClass.Excavator) {
              damageToDeal *= (10 / 0.75); // 10x damage to shapes, compensating for the 0.75x base multiplier
            }
            s.takeDamage(damageToDeal, b.ownerId);
            
            if (s.shapeType === ShapeType.ROCK) {
              if (b.ownerClass !== TankClass.Excavator) {
                const normal = b.pos.sub(s.pos).normalize();
                const dot = b.vel.dot(normal);
                if (dot < 0) {
                  b.vel = b.vel.sub(normal.mult(2 * dot)).mult(0.8);
                }
              }
            } else {
              const dir = s.pos.sub(b.pos).normalize();
              s.vel = s.vel.add(dir.mult(100 * dt));
            }

            if (s.dead) this.giveXp(b.ownerId, s.xpValue);
          }
        } else if (other instanceof Crasher) {
          const c = other;
          if (b.pos.dist(c.pos) < b.radius + c.radius) {
            b.isDamaging = true;
            let damageToDeal = b.damage * dt;
            if (b.ownerClass === TankClass.Excavator) damageToDeal *= 0.75;
            c.takeDamage(damageToDeal, b.ownerId);
            if (c.dead) this.giveXp(b.ownerId, 15);
          }
        } else if (other instanceof EnemyTank) {
          const e = other;
          if (b.ownerId !== e.id && b.pos.dist(e.pos) < b.radius + e.radius) {
            b.isDamaging = true;
            if (b.isRailgun) {
              e.takeDamage(e.maxHealth, b.ownerId);
            } else {
              let damageToDeal = b.damage * dt;
              if (b.ownerClass === TankClass.Excavator) damageToDeal *= 0.75;
              e.takeDamage(damageToDeal, b.ownerId);
            }
            if (e.dead) {
              const totalScore = calculateTotalXp(e.level, e.xp);
              const xpReward = Math.floor(Math.pow(Math.sqrt(totalScore), 1.7));
              this.giveXp(b.ownerId, xpReward);
            }
          }
        } else if (other instanceof Player) {
          const p = other;
          if (!p.isInvincible && b.ownerId !== p.id && b.pos.dist(p.pos) < b.radius + p.radius) {
            b.isDamaging = true;
            if (b.isRailgun) {
              p.takeDamage(p.maxHealth, b.ownerId);
            } else {
              let damageToDeal = b.damage * dt;
              if (b.ownerClass === TankClass.Excavator) damageToDeal *= 0.75;
              p.takeDamage(damageToDeal, b.ownerId);
            }
          }
        }
      }
    }

    // Trap collisions
    for (const t of this.traps) {
      if (t.dead) continue;
      const nearby = this.grid.getNearby(t.pos.x, t.pos.y, t.radius + 150);
      for (const other of nearby) {
        if (other.dead || other === t) continue;
        
        if (other instanceof Shape) {
          const s = other;
          if (t.pos.dist(s.pos) < t.radius + s.radius) {
            t.isDamaging = true;
            s.takeDamage(t.damage * dt, t.ownerId);
            
            if (s.shapeType === ShapeType.ROCK) {
              const normal = t.pos.sub(s.pos).normalize();
              const dot = t.vel.dot(normal);
              if (dot < 0) {
                t.vel = t.vel.sub(normal.mult(2 * dot)).mult(0.8);
              }
            } else {
              const dir = s.pos.sub(t.pos).normalize();
              s.vel = s.vel.add(dir.mult(100 * dt));
            }

            if (s.dead) this.giveXp(t.ownerId, s.xpValue);
          }
        } else if (other instanceof Crasher) {
          const c = other;
          if (t.pos.dist(c.pos) < t.radius + c.radius) {
            t.isDamaging = true;
            c.takeDamage(t.damage * dt, t.ownerId);
            const dir = c.pos.sub(t.pos).normalize();
            c.vel = c.vel.add(dir.mult(100 * dt));
            if (c.dead) this.giveXp(t.ownerId, 15);
          }
        } else if (other instanceof EnemyTank) {
          const e = other;
          if (t.ownerId !== e.id && t.pos.dist(e.pos) < t.radius + e.radius) {
            t.isDamaging = true;
            e.takeDamage(t.damage * dt, t.ownerId);
            const dir = e.pos.sub(t.pos).normalize();
            e.vel = e.vel.add(dir.mult(100 * dt));
            if (e.dead) {
              const totalScore = calculateTotalXp(e.level, e.xp);
              const xpReward = Math.floor(Math.pow(Math.sqrt(totalScore), 1.7));
              this.giveXp(t.ownerId, xpReward);
            }
          }
        } else if (other instanceof Player) {
          const p = other;
          if (!p.isInvincible && t.ownerId !== p.id && t.pos.dist(p.pos) < t.radius + p.radius) {
            t.isDamaging = true;
            p.takeDamage(t.damage * dt, t.ownerId);
            const dist = t.pos.dist(p.pos);
            const minDist = t.radius + p.radius;
            const overlap = minDist - dist;
            const dir = p.pos.sub(t.pos).normalize();
            
            p.pos = p.pos.add(dir.mult(overlap * 0.8));
            t.pos = t.pos.sub(dir.mult(overlap * 0.2));
            
            p.vel = p.vel.add(dir.mult(50 * dt));
            t.vel = t.vel.sub(dir.mult(50 * dt));
          }
        } else if (other instanceof Drone) {
          const d = other;
          if (t.ownerId !== d.ownerId && t.pos.dist(d.pos) < t.radius + d.radius) {
            t.isDamaging = true;
            const dist = t.pos.dist(d.pos);
            const minDist = t.radius + d.radius;
            const overlap = minDist - dist;
            const dir = d.pos.sub(t.pos).normalize();
            
            d.pos = d.pos.add(dir.mult(overlap * 0.8));
            t.pos = t.pos.sub(dir.mult(overlap * 0.2));
            
            d.vel = d.vel.add(dir.mult(50 * dt));
            t.vel = t.vel.sub(dir.mult(50 * dt));
          }
        } else if (other instanceof Trap && other.id > t.id) {
          const t2 = other;
          const dist = t.pos.dist(t2.pos);
          const minDist = t.radius + t2.radius;
          if (dist < minDist && dist > 0) {
            const overlap = minDist - dist;
            const dir = t2.pos.sub(t.pos).normalize();
            
            t.pos = t.pos.sub(dir.mult(overlap * 0.5));
            t2.pos = t2.pos.add(dir.mult(overlap * 0.5));
            
            const relVel = t.vel.sub(t2.vel);
            const speed = relVel.dot(dir);
            
            if (speed > 0) {
              const bounce = dir.mult(speed * 0.5);
              t.vel = t.vel.sub(bounce);
              t2.vel = t2.vel.add(bounce);
            }
          }
        }
      }
    }

    // Drone collisions
    for (const d of this.drones) {
      if (d.dead) continue;
      const nearby = this.grid.getNearby(d.pos.x, d.pos.y, d.radius + 150);
      for (const other of nearby) {
        if (other.dead || other === d) continue;
        
        if (other instanceof Shape) {
          const s = other;
          if (d.pos.dist(s.pos) < d.radius + s.radius) {
            // Underseer logic: turn squares into drones
            const isUnderseerClass = d.ownerClass === TankClass.Underseer || 
                                     d.ownerClass === TankClass.AutoUnderseer ||
                                     d.ownerClass === TankClass.Necromancer ||
                                     d.ownerClass === TankClass.GreyGoo ||
                                     d.ownerClass === TankClass.Lich;
            
            if (isUnderseerClass && s.shapeType === ShapeType.SQUARE && !s.dead) {
              // Check drone cap
              let owner: Player | EnemyTank | undefined;
              if (this.players.has(d.ownerId)) {
                owner = this.players.get(d.ownerId);
              } else {
                owner = this.enemies.find(e => e.id === d.ownerId);
              }

              if (owner) {
                const currentDroneCount = this.drones.filter(dr => dr.ownerId === d.ownerId && !dr.isCruiser).length;
                
                // Calculate max drones
                let maxDrones = 8;
                const reloadPoints = owner.stats.reload || 0;
                for (let r = 0; r < reloadPoints; r++) {
                  if (r < 7) maxDrones += 4;
                  else maxDrones += 2;
                }
                
                if (currentDroneCount < maxDrones) {
                  s.dead = true;
                  const drone = new Drone(
                    s.pos.copy(),
                    new Vector(Math.random() - 0.5, Math.random() - 0.5).normalize().mult(50),
                    d.ownerId,
                    d.color,
                    d.damage,
                    d.penetration,
                    15,
                    200,
                    false,
                    d.ownerClass,
                    MissileType.UnderseerDrone
                  );
                  this.drones.push(drone);
                  this.giveXp(d.ownerId, s.xpValue);
                  continue; // Skip normal damage logic
                }
              }
            }

            d.isDamaging = true;
            s.takeDamage(d.damage * dt, d.ownerId);
            
            const dist = d.pos.dist(s.pos);
            const minDist = d.radius + s.radius;
            const overlap = minDist - dist;
            const dir = d.pos.sub(s.pos).normalize();
            
            d.pos = d.pos.add(dir.mult(overlap));
            
            const pushForce = s.isAlpha ? 10 : 100;
            if (s.shapeType !== ShapeType.ROCK) {
              s.vel = s.vel.add(dir.mult(pushForce * dt));
            }
            d.vel = d.vel.sub(dir.mult(pushForce * dt));

            if (s.dead) this.giveXp(d.ownerId, s.xpValue);
          }
        } else if (other instanceof Crasher) {
          const c = other;
          if (d.pos.dist(c.pos) < d.radius + c.radius) {
            d.isDamaging = true;
            c.takeDamage(d.damage * dt, d.ownerId);
            const dir = c.pos.sub(d.pos).normalize();
            c.vel = c.vel.add(dir.mult(100 * dt));
            d.vel = d.vel.sub(dir.mult(100 * dt));
            if (c.dead) this.giveXp(d.ownerId, 15);
          }
        } else if (other instanceof EnemyTank) {
          const e = other;
          if (d.ownerId !== e.id && d.pos.dist(e.pos) < d.radius + e.radius) {
            d.isDamaging = true;
            e.takeDamage(d.damage * dt, d.ownerId);
            const dir = e.pos.sub(d.pos).normalize();
            e.vel = e.vel.add(dir.mult(100 * dt));
            d.vel = d.vel.sub(dir.mult(100 * dt));
            if (e.dead) {
              const totalScore = calculateTotalXp(e.level, e.xp);
              const xpReward = Math.floor(Math.pow(Math.sqrt(totalScore), 1.7));
              this.giveXp(d.ownerId, xpReward);
            }
          }
        } else if (other instanceof Player) {
          const p = other;
          if (!p.isInvincible && d.ownerId !== p.id && d.pos.dist(p.pos) < d.radius + p.radius) {
            d.isDamaging = true;
            p.takeDamage(d.damage * dt, d.ownerId);
            const dir = p.pos.sub(d.pos).normalize();
            p.vel = p.vel.add(dir.mult(100 * dt));
            d.vel = d.vel.sub(dir.mult(100 * dt));
          }
        } else if (other instanceof Drone && other.id > d.id) {
          const d2 = other;
          const dist = d.pos.dist(d2.pos);
          const minDist = d.radius + d2.radius;
          if (dist < minDist && dist > 0) {
            const overlap = minDist - dist;
            const dir = d2.pos.sub(d.pos).normalize();
            
            d.pos = d.pos.sub(dir.mult(overlap * 0.5));
            d2.pos = d2.pos.add(dir.mult(overlap * 0.5));
            
            d.vel = d.vel.sub(dir.mult(10));
            d2.vel = d2.vel.add(dir.mult(10));
          }
        }
      }
    }

    // Player collisions
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const bodyDamage = 400 + getEffectiveStat(p.stats.bodyDamage) * 200;
      const nearby = this.grid.getNearby(p.pos.x, p.pos.y, p.radius + 150);
      for (const other of nearby) {
        if (other.dead || other === p) continue;
        
        if (other instanceof Shape) {
          const s = other;
          if (!p.isInvincible && p.pos.dist(s.pos) < p.radius + s.radius) {
            s.takeDamage(bodyDamage * dt, p.id);
            p.takeDamage(s.damage * dt, s.id);
            
            const dist = p.pos.dist(s.pos);
            const minDist = p.radius + s.radius;
            const overlap = minDist - dist;
            const dir = p.pos.sub(s.pos).normalize();
            
            p.pos = p.pos.add(dir.mult(overlap));
            
            const pushForce = s.isAlpha ? 15 : 150;
            p.vel = p.vel.add(dir.mult(pushForce * dt));
            if (s.shapeType !== ShapeType.ROCK) {
              s.vel = s.vel.sub(dir.mult(pushForce * dt));
            }

            if (s.dead) p.gainXp(s.xpValue);
          }
        } else if (other instanceof Crasher) {
          const c = other;
          if (!p.isInvincible && p.pos.dist(c.pos) < p.radius + c.radius) {
            c.takeDamage(bodyDamage * dt, p.id);
            p.takeDamage(c.damage * dt, c.id);
            const dir = p.pos.sub(c.pos).normalize();
            p.vel = p.vel.add(dir.mult(200 * dt));
            c.vel = c.vel.sub(dir.mult(200 * dt));

            if (c.dead) p.gainXp(15);
          }
        }
      }
    }

    // Crasher collisions
    for (const c of this.crashers) {
      if (c.dead) continue;
      const nearby = this.grid.getNearby(c.pos.x, c.pos.y, c.radius + 150);
      for (const other of nearby) {
        if (other.dead || other === c) continue;
        
        if (other instanceof Shape) {
          const s = other;
          if (c.pos.dist(s.pos) < c.radius + s.radius) {
            const dist = c.pos.dist(s.pos);
            const minDist = c.radius + s.radius;
            const overlap = minDist - dist;
            const dir = c.pos.sub(s.pos).normalize();
            
            c.pos = c.pos.add(dir.mult(overlap));
            
            if (s.shapeType !== ShapeType.ROCK) {
              s.vel = s.vel.add(dir.mult(100 * dt));
              c.vel = c.vel.sub(dir.mult(100 * dt));
            }
          }
        }
      }
    }

    // Enemy collisions
    for (const e of this.enemies) {
      if (e.dead) continue;
      const nearby = this.grid.getNearby(e.pos.x, e.pos.y, e.radius + 150);
      for (const other of nearby) {
        if (other.dead || other === e) continue;
        
        if (other instanceof Shape) {
          const s = other;
          if (e.pos.dist(s.pos) < e.radius + s.radius) {
            s.takeDamage(100 * dt, e.id);
            e.takeDamage(s.damage * dt, s.id);

            const dist = e.pos.dist(s.pos);
            const minDist = e.radius + s.radius;
            const overlap = minDist - dist;
            const dir = e.pos.sub(s.pos).normalize();
            
            e.pos = e.pos.add(dir.mult(overlap));
            
            const pushForce = s.isAlpha ? 15 : 150;
            e.vel = e.vel.add(dir.mult(pushForce * dt));
            if (s.shapeType !== ShapeType.ROCK) {
              s.vel = s.vel.sub(dir.mult(pushForce * dt));
            }

            if (s.dead) e.gainXp(s.xpValue);
          }
        } else if (other instanceof EnemyTank && other.id > e.id) {
          const otherE = other;
          if (e.pos.dist(otherE.pos) < e.radius + otherE.radius) {
            const bodyDamageE = 400 + e.stats.bodyDamage * 200;
            const bodyDamageOther = 400 + otherE.stats.bodyDamage * 200;
            otherE.takeDamage(bodyDamageE * dt, e.id);
            e.takeDamage(bodyDamageOther * dt, otherE.id);
            
            const dir = e.pos.sub(otherE.pos).normalize();
            e.vel = e.vel.add(dir.mult(150 * dt));
            otherE.vel = otherE.vel.sub(dir.mult(150 * dt));
            
            if (otherE.dead) {
              const totalScore = calculateTotalXp(otherE.level, otherE.xp);
              const xpReward = Math.floor(Math.pow(Math.sqrt(totalScore), 1.7));
              e.gainXp(xpReward);
            }
            if (e.dead) {
              const totalScore = calculateTotalXp(e.level, e.xp);
              const xpReward = Math.floor(Math.pow(Math.sqrt(totalScore), 1.7));
              otherE.gainXp(xpReward);
            }
          }
        }
      }
    }
  }

  drawName(name: string, pos: Vector, radius: number) {
    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 14px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(name, pos.x, pos.y - radius - 15);
    this.ctx.fillText(name, pos.x, pos.y - radius - 15);
    this.ctx.restore();
  }

  draw() {
    this.ctx.fillStyle = '#888888'; // Grey area outside
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Interpolate all entities
    const interpolateEntity = (e: Entity) => {
      if (e.id === this.myPlayerId) {
        e.renderPos = e.pos.copy();
      } else {
        e.interpolate(this.localServerTime);
      }
    };

    for (const p of this.players.values()) interpolateEntity(p);
    for (const b of this.bullets) interpolateEntity(b);
    for (const t of this.traps) interpolateEntity(t);
    for (const d of this.drones) interpolateEntity(d);
    for (const s of this.shapes) interpolateEntity(s);
    for (const c of this.crashers) interpolateEntity(c);
    for (const e of this.enemies) interpolateEntity(e);

    this.ctx.save();
    
    // Apply FOV scaling
    const fovMult = this.player ? getFovMult(this.player.tankClass) : 1;
    const baseScale = Math.min(this.canvas.width / 1920, this.canvas.height / 1080);
    
    // Update camera to follow target if set
    if (this.cameraTargetId !== null) {
      const target = this.players.get(this.cameraTargetId) || this.enemyMap.get(this.cameraTargetId) || this.crasherMap.get(this.cameraTargetId) || this.shapeMap.get(this.cameraTargetId);
      if (target) {
        this.camera = target.renderPos.copy();
      }
    }
    
    // Adjust scale based on screen ratio for mobile
    let ratioScale = 1;
    const ratio = this.width / this.height;
    if (this.isMobile) {
      if (ratio < 1) { // Portrait
        ratioScale = 0.6; // Zoom out more in portrait
      } else {
        ratioScale = 0.8;
      }
    }
    
    const scale = baseScale * 1.5 / fovMult * ratioScale;
    
    const viewWidth = this.width / scale;
    const viewHeight = this.height / scale;
    const viewLeft = this.camera.x - viewWidth / 2;
    const viewRight = this.camera.x + viewWidth / 2;
    const viewTop = this.camera.y - viewHeight / 2;
    const viewBottom = this.camera.y + viewHeight / 2;

    const drawEntity = (e: Entity) => {
      if (e.renderPos.x + e.radius < viewLeft || e.renderPos.x - e.radius > viewRight ||
          e.renderPos.y + e.radius < viewTop || e.renderPos.y - e.radius > viewBottom) {
        return;
      }
      e.draw(this.ctx);
    };
    
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw map background
    this.ctx.fillStyle = '#cdcdcd';
    this.ctx.fillRect(0, 0, this.worldSize.width, this.worldSize.height);

    // Draw grid
    this.ctx.strokeStyle = '#c6c6c6';
    this.ctx.lineWidth = 1 / scale;
    const gridSize = 30;
    const startX = Math.floor((this.camera.x - (this.width / 2) / scale) / gridSize) * gridSize;
    const startY = Math.floor((this.camera.y - (this.height / 2) / scale) / gridSize) * gridSize;
    
    this.ctx.beginPath();
    for (let x = startX; x < this.camera.x + (this.width / 2) / scale; x += gridSize) {
      this.ctx.moveTo(x, this.camera.y - (this.height / 2) / scale);
      this.ctx.lineTo(x, this.camera.y + (this.height / 2) / scale);
    }
    for (let y = startY; y < this.camera.y + (this.height / 2) / scale; y += gridSize) {
      this.ctx.moveTo(this.camera.x - (this.width / 2) / scale, y);
      this.ctx.lineTo(this.camera.x + (this.width / 2) / scale, y);
    }
    this.ctx.stroke();

    // Draw world bounds
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 5;
    this.ctx.strokeRect(0, 0, this.worldSize.width, this.worldSize.height);

    // Draw pentagon nest
    this.ctx.fillStyle = 'rgba(138, 143, 226, 0.2)'; // light blue-purple
    this.ctx.beginPath();
    this.ctx.arc(this.worldSize.width / 2, this.worldSize.height / 2, 2250, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw hexagon nest
    this.ctx.fillStyle = 'rgba(37, 220, 252, 0.2)'; // cyan
    this.ctx.beginPath();
    this.ctx.arc(this.worldSize.width / 2, this.worldSize.height / 2, 1200, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw heptagon nest
    this.ctx.fillStyle = 'rgba(252, 155, 37, 0.2)'; // orange
    this.ctx.beginPath();
    this.ctx.arc(this.worldSize.width / 2, this.worldSize.height / 2, 500, 0, Math.PI * 2);
    this.ctx.fill();

    for (const s of this.shapes) drawEntity(s);
    for (const t of this.traps) drawEntity(t);
    for (const d of this.drones) drawEntity(d);
    for (const c of this.crashers) drawEntity(c);
    
    for (const e of this.enemies) {
      drawEntity(e);
      if (e.renderPos.x + e.radius >= viewLeft && e.renderPos.x - e.radius <= viewRight &&
          e.renderPos.y + e.radius >= viewTop && e.renderPos.y - e.radius <= viewBottom) {
        this.drawName(e.name, e.renderPos, e.radius);
      }
    }
    
    for (const b of this.bullets) drawEntity(b);
    
    for (const p of this.players.values()) {
      drawEntity(p);
      if (p.id !== this.myPlayerId && 
          p.renderPos.x + p.radius >= viewLeft && p.renderPos.x - p.radius <= viewRight &&
          p.renderPos.y + p.radius >= viewTop && p.renderPos.y - p.radius <= viewBottom) {
        this.drawName(p.name, p.renderPos, p.radius);
      }
    }

    this.ctx.restore();
    
    // Desync Warning
    if (this.desyncTimer > 0.5) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      this.ctx.font = 'bold 24px Ubuntu, Arial';
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = 'black';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText('DESYNC DETECTED - PRESS TAB+R TO FORCE SYNC', this.width / 2, 120);
      this.ctx.restore();
    }

    this.drawMinimap();
    if (this.isMobile) {
      this.drawJoysticks();
    }
  }
  
  drawMinimap() {
    const size = 150;
    const padding = 20;
    const x = this.width - size - padding;
    const y = this.height - size - padding;

    this.ctx.save();
    
    // Minimap background
    this.ctx.fillStyle = '#dcdcdc';
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillRect(x, y, size, size);
    
    // Minimap border
    this.ctx.globalAlpha = 1.0;
    this.ctx.strokeStyle = '#777777';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(x, y, size, size);

    // Draw nest on minimap
    const nestX = x + (this.worldSize.width / 2 / this.worldSize.width) * size;
    const nestY = y + (this.worldSize.height / 2 / this.worldSize.height) * size;
    
    // Pentagon nest
    const nestRPentagon = (2250 / this.worldSize.width) * size;
    this.ctx.fillStyle = 'rgba(138, 143, 226, 0.5)';
    this.ctx.beginPath();
    this.ctx.arc(nestX, nestY, nestRPentagon, 0, Math.PI * 2);
    this.ctx.fill();

    // Hexagon nest
    const nestRHexagon = (1200 / this.worldSize.width) * size;
    this.ctx.fillStyle = 'rgba(37, 220, 252, 0.5)';
    this.ctx.beginPath();
    this.ctx.arc(nestX, nestY, nestRHexagon, 0, Math.PI * 2);
    this.ctx.fill();

    // Heptagon nest
    const nestRHeptagon = (500 / this.worldSize.width) * size;
    this.ctx.fillStyle = 'rgba(252, 155, 37, 0.5)';
    this.ctx.beginPath();
    this.ctx.arc(nestX, nestY, nestRHeptagon, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw rocks on minimap
    this.ctx.fillStyle = '#888888';
    for (const s of this.shapes) {
      if (s.shapeType === ShapeType.ROCK) {
        const rx = x + (s.pos.x / this.worldSize.width) * size;
        const ry = y + (s.pos.y / this.worldSize.height) * size;
        this.ctx.beginPath();
        this.ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Draw players
    for (const p of this.players.values()) {
      const px = x + (p.pos.x / this.worldSize.width) * size;
      const py = y + (p.pos.y / this.worldSize.height) * size;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = p.id === this.myPlayerId ? '#000000' : '#ff0000';
      this.ctx.fill();
    }

    this.ctx.restore();
    
    if (this.isMobile) {
      this.drawJoysticks();
    }
  }
  
  drawJoysticks() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.3;
    
    // Left Joystick
    if (this.leftJoystick.active) {
      this.ctx.beginPath();
      this.ctx.arc(this.leftJoystick.startPos.x, this.leftJoystick.startPos.y, 60, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(this.leftJoystick.currentPos.x, this.leftJoystick.currentPos.y, 30, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
    }
    
    // Right Joystick
    if (this.rightJoystick.active) {
      this.ctx.beginPath();
      this.ctx.arc(this.rightJoystick.startPos.x, this.rightJoystick.startPos.y, 60, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(this.rightJoystick.currentPos.x, this.rightJoystick.currentPos.y, 30, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }
  
  upgradeStat(stat: keyof Player['stats']) {
    if (!this.isServer) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const writer = new BinaryWriter();
      writer.writeUint8(2); // UPGRADE_STAT
      writer.writeString(stat);
      this.ws.send(writer.getBuffer());
      return;
    }
    const maxStat = this.player && this.player.level >= 80 ? 14 : 7;
    if (this.player && this.player.skillPoints > 0 && this.player.stats[stat] < maxStat) {
      this.player.stats[stat]++;
      this.player.skillPoints--;
      if (stat === 'maxHealth') {
        this.player.maxHealth += 5;
        this.player.health += 5;
      }
    }
  }

  upgradeClass(newClass: TankClass) {
    if (!this.isServer) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const writer = new BinaryWriter();
      writer.writeUint8(3); // UPGRADE_CLASS
      writer.writeString(newClass);
      this.ws.send(writer.getBuffer());
      return;
    }
    if (this.player) this.player.upgradeClass(newClass);
  }
}
