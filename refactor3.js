import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// Add isServer, players, myPlayerId, inputs
content = content.replace('export class Game {', `export class Game {
  isServer: boolean = false;
  players: Map<number, Player> = new Map();
  myPlayerId: number | null = null;
  inputs: Map<number, any> = new Map();`);

// Change constructor
content = content.replace('  constructor(canvas: HTMLCanvasElement) {', `  constructor(canvas?: HTMLCanvasElement, isServer: boolean = false) {
    this.isServer = isServer;
    if (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d')!;
      this.width = canvas.width;
      this.height = canvas.height;
      this.setupInputs();
    }`);

// Change this.player initialization
content = content.replace(/    this\.player = new Player\(new Vector\(Math\.random\(\) \* this\.worldSize\.width, Math\.random\(\) \* this\.worldSize\.height\)\);\n/, '');

// Add player getter
content = content.replace('  player: Player;', `  get player(): Player {
    if (this.myPlayerId !== null && this.players.has(this.myPlayerId)) {
      return this.players.get(this.myPlayerId)!;
    }
    // Return a dummy player to avoid null checks everywhere if not initialized
    return new Player(new Vector(0, 0));
  }`);

// In update, we need to iterate over this.players.
// Since this is hard to do with regex, I'll just use a script to replace the whole update method.

fs.writeFileSync('src/game/Game.ts', content);
