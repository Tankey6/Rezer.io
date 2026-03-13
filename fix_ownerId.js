import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, search, replace) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(search, replace);
  fs.writeFileSync(filePath, content);
}

replaceInFile('src/game/Game.ts', /ownerId: string/g, 'ownerId: number');
replaceInFile('src/game/ServerGame.ts', /ownerId: string/g, 'ownerId: number');
replaceInFile('src/game/entities/Drone.ts', /ownerId: string/g, 'ownerId: number');
replaceInFile('src/game/entities/Trap.ts', /ownerId: string/g, 'ownerId: number');
replaceInFile('src/game/entities/Bullet.ts', /ownerId: string/g, 'ownerId: number');

console.log('Done');
