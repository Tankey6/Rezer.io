import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// Add isServer, players, myPlayerId
content = content.replace('export class Game {', `export class Game {
  isServer: boolean;
  players: Map<number, Player> = new Map();
  myPlayerId: number | null = null;
  inputs: Map<number, any> = new Map();`);

// Remove single player
content = content.replace('  player: Player;\n', '');

// Update constructor
content = content.replace('  constructor(canvas: HTMLCanvasElement) {', `  constructor(isServer: boolean, canvas?: HTMLCanvasElement) {
    this.isServer = isServer;
    if (!isServer && canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d')!;
      this.width = canvas.width;
      this.height = canvas.height;
      this.setupInputs();
    }
    if (isServer) {
      this.initShapes();
      this.initEnemies();
    }`);

// Remove this.player initialization
content = content.replace(/    this\.player = new Player\(new Vector\(Math\.random\(\) \* this\.worldSize\.width, Math\.random\(\) \* this\.worldSize\.height\)\);\n    \n    this\.initShapes\(\);\n    this\.initEnemies\(\);\n    this\.setupInputs\(\);\n/, '');

// Replace this.player with player in update loop
// We need to wrap the player update logic in a loop
// This is tricky with regex. Let's just do it manually or with a more sophisticated script.
