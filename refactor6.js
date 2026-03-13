import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// Fix spawnEnemyTank
content = content.replace(/    if \(pos\.dist\(this\.player\.pos\) < 1000\) {/g, '    if (this.player && pos.dist(this.player.pos) < 1000) {');

// Fix setupInputs
content = content.replace(/        const nextLevelExp = 100 \* Math\.pow\(this\.player\.level, 1\.5\);\n        this\.player\.gainXp\(nextLevelExp - this\.player\.xp\);/g, `        if (this.player) {
          const nextLevelExp = 100 * Math.pow(this.player.level, 1.5);
          this.player.gainXp(nextLevelExp - this.player.xp);
        }`);
content = content.replace(/        this\.player\.takeDamage\(this\.player\.health\);/g, `        if (this.player) this.player.takeDamage(this.player.health);`);

// Fix loop
content = content.replace(/    if \(!this\.player\.dead\) {/g, `    if (!this.player || !this.player.dead) {`);

// Fix FOV
content = content.replace(/    const fovMult = FOV_MULT\[this\.player\.tankClass\] \|\| 1;/g, `    const fovMult = this.player ? (FOV_MULT[this.player.tankClass] || 1) : 1;`);

// Fix upgradeStat
content = content.replace(/  upgradeStat\(stat: keyof Player\['stats'\]\) {[\s\S]*?  }/, `  upgradeStat(stat: keyof Player['stats']) {
    if (this.player && this.player.skillPoints > 0 && this.player.stats[stat] < 7) {
      this.player.stats[stat]++;
      this.player.skillPoints--;
      if (stat === 'maxHealth') {
        this.player.maxHealth += 5;
        this.player.health += 5;
      }
    }
  }`);

// Fix upgradeClass
content = content.replace(/  upgradeClass\(newClass: TankClass\) {[\s\S]*?  }/, `  upgradeClass(newClass: TankClass) {
    if (this.player) this.player.upgradeClass(newClass);
  }`);

fs.writeFileSync('src/game/Game.ts', content);
