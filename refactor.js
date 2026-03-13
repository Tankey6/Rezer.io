import fs from 'fs';

let content = fs.readFileSync('src/game/ServerGame.ts', 'utf-8');

// Replace class name
content = content.replace('export class Game {', 'export class ServerGame {');

// Remove canvas and ctx
content = content.replace(/  canvas: HTMLCanvasElement;\n  ctx: CanvasRenderingContext2D;\n  width: number;\n  height: number;\n/g, '');

// Replace player with players
content = content.replace(/  player: Player;/g, '  players: Map<string, Player> = new Map();\n  inputs: Map<string, any> = new Map();');

// Remove keys, mousePos, etc.
content = content.replace(/  keys: { \[key: string\]: boolean } = {};\n  mousePos: Vector = new Vector\(0, 0\);\n  mouseDown: boolean = false;\n  autoFire: boolean = false;\n/g, '');
content = content.replace(/  \/\/ Mobile controls\n  isMobile: boolean = false;\n  leftJoystick: { .* } = { .* };\n  rightJoystick: { .* } = { .* };\n/g, '');
content = content.replace(/  camera: Vector = new Vector\(0, 0\);\n/g, '');

// Constructor
content = content.replace(/  constructor\(canvas: HTMLCanvasElement\) {[\s\S]*?this\.setupInputs\(\);\n  }/, `  constructor() {
    this.initShapes();
    this.initEnemies();
  }`);

// Remove setupInputs
content = content.replace(/  setupInputs\(\) {[\s\S]*?  }\n  \n  cleanup: \(\) => void = \(\) => {};/g, '');

// Remove resize
content = content.replace(/  resize\(width: number, height: number\) {[\s\S]*?  }/g, '');

// Remove draw
content = content.replace(/  draw\(\) {[\s\S]*?  }\n  \n  drawMinimap\(\) {[\s\S]*?  }\n  \n  drawJoysticks\(\) {[\s\S]*?  }/g, '');

// Remove upgradeStat and upgradeClass (moved to player methods or handled via network)
content = content.replace(/  upgradeStat\(stat: keyof Player\['stats'\]\) {[\s\S]*?  }\n\n  upgradeClass\(newClass: TankClass\) {[\s\S]*?  }/g, '');

// Replace this.player with player iteration in update
// This is complex, so let's just do a basic replacement and then fix it manually.

fs.writeFileSync('src/game/ServerGame.ts', content);
console.log('Done');
