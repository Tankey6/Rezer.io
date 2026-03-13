import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// Player vs Shape
content = content.replace(/\/\/ Player vs Shape\n    const bodyDamage = 400 \+ this\.player\.stats\.bodyDamage \* 200;\n    for \(const s of this\.shapes\) {\n      if \(!s\.dead && this\.player\.pos\.dist\(s\.pos\) < this\.player\.radius \+ s\.radius\) {\n        s\.takeDamage\(bodyDamage \* dt\);\n        this\.player\.takeDamage\(s\.damage \* dt\);\n        \n        const dir = this\.player\.pos\.sub\(s\.pos\)\.normalize\(\);\n        this\.player\.vel = this\.player\.vel\.add\(dir\.mult\(150 \* dt\)\);\n        s\.vel = s\.vel\.sub\(dir\.mult\(150 \* dt\)\);\n\n        if \(s\.dead\) this\.player\.gainXp\(s\.xpValue\);\n      }\n    }/g, `// Player vs Shape
    for (const p of this.players.values()) {
      const bodyDamage = 400 + p.stats.bodyDamage * 200;
      for (const s of this.shapes) {
        if (!s.dead && !p.dead && p.pos.dist(s.pos) < p.radius + s.radius) {
          s.takeDamage(bodyDamage * dt);
          p.takeDamage(s.damage * dt);
          
          const dir = p.pos.sub(s.pos).normalize();
          p.vel = p.vel.add(dir.mult(150 * dt));
          s.vel = s.vel.sub(dir.mult(150 * dt));

          if (s.dead) p.gainXp(s.xpValue);
        }
      }
    }`);

// Player vs Crasher
content = content.replace(/\/\/ Player vs Crasher\n    for \(const c of this\.crashers\) {\n      if \(!c\.dead && this\.player\.pos\.dist\(c\.pos\) < this\.player\.radius \+ c\.radius\) {\n        c\.takeDamage\(bodyDamage \* dt\);\n        this\.player\.takeDamage\(c\.damage \* dt\);\n        const dir = this\.player\.pos\.sub\(c\.pos\)\.normalize\(\);\n        this\.player\.vel = this\.player\.vel\.add\(dir\.mult\(200 \* dt\)\);\n        c\.vel = c\.vel\.sub\(dir\.mult\(200 \* dt\)\);\n\n        if \(c\.dead\) this\.player\.gainXp\(15\);\n      }\n    }/g, `// Player vs Crasher
    for (const p of this.players.values()) {
      const bodyDamage = 400 + p.stats.bodyDamage * 200;
      for (const c of this.crashers) {
        if (!c.dead && !p.dead && p.pos.dist(c.pos) < p.radius + c.radius) {
          c.takeDamage(bodyDamage * dt);
          p.takeDamage(c.damage * dt);
          const dir = p.pos.sub(c.pos).normalize();
          p.vel = p.vel.add(dir.mult(200 * dt));
          c.vel = c.vel.sub(dir.mult(200 * dt));

          if (c.dead) p.gainXp(15);
        }
      }
    }`);

// Bullet vs Player
content = content.replace(/\/\/ Bullet vs Player\n      if \(!b\.dead && b\.ownerId !== this\.player\.id && b\.pos\.dist\(this\.player\.pos\) < b\.radius \+ this\.player\.radius\) {\n        b\.isDamaging = true;\n        this\.player\.takeDamage\(b\.damage \* dt\);\n      }/g, `// Bullet vs Player
      for (const p of this.players.values()) {
        if (!b.dead && !p.dead && b.ownerId !== p.id && b.pos.dist(p.pos) < b.radius + p.radius) {
          b.isDamaging = true;
          p.takeDamage(b.damage * dt);
        }
      }`);

fs.writeFileSync('src/game/Game.ts', content);
