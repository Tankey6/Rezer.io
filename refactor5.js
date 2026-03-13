import fs from 'fs';

let content = fs.readFileSync('src/game/Game.ts', 'utf-8');

// Replace this.player in checkCollisions
content = content.replace(/\/\/ Traps vs Player\n      if \(!t\.dead && !this\.player\.dead && t\.ownerId !== this\.player\.id && t\.pos\.dist\(this\.player\.pos\) < t\.radius \+ this\.player\.radius\) {\n        t\.isDamaging = true;\n        this\.player\.takeDamage\(t\.damage \* dt\);\n        const dir = this\.player\.pos\.sub\(t\.pos\)\.normalize\(\);\n        this\.player\.vel = this\.player\.vel\.add\(dir\.mult\(100 \* dt\)\);\n      }/g, `// Traps vs Player
      for (const p of this.players.values()) {
        if (!t.dead && !p.dead && t.ownerId !== p.id && t.pos.dist(p.pos) < t.radius + p.radius) {
          t.isDamaging = true;
          p.takeDamage(t.damage * dt);
          const dir = p.pos.sub(t.pos).normalize();
          p.vel = p.vel.add(dir.mult(100 * dt));
        }
      }`);

content = content.replace(/\/\/ Drones vs Player\n      if \(!d\.dead && !this\.player\.dead && d\.ownerId !== this\.player\.id && d\.pos\.dist\(this\.player\.pos\) < d\.radius \+ this\.player\.radius\) {\n        d\.isDamaging = true;\n        this\.player\.takeDamage\(d\.damage \* dt\);\n        const dir = this\.player\.pos\.sub\(d\.pos\)\.normalize\(\);\n        this\.player\.vel = this\.player\.vel\.add\(dir\.mult\(100 \* dt\)\);\n        d\.vel = d\.vel\.sub\(dir\.mult\(100 \* dt\)\);\n      }/g, `// Drones vs Player
      for (const p of this.players.values()) {
        if (!d.dead && !p.dead && d.ownerId !== p.id && d.pos.dist(p.pos) < d.radius + p.radius) {
          d.isDamaging = true;
          p.takeDamage(d.damage * dt);
          const dir = p.pos.sub(d.pos).normalize();
          p.vel = p.vel.add(dir.mult(100 * dt));
          d.vel = d.vel.sub(dir.mult(100 * dt));
        }
      }`);

content = content.replace(/\/\/ Player vs Shape\n    const bodyDamage = 400 \+ this\.player\.stats\.bodyDamage \* 200;\n    for \(const s of this\.shapes\) {\n      if \(!s\.dead && !this\.player\.dead && this\.player\.pos\.dist\(s\.pos\) < this\.player\.radius \+ s\.radius\) {\n        s\.takeDamage\(bodyDamage \* dt\);\n        this\.player\.takeDamage\(s\.damage \* dt\);\n        \n        const dir = s\.pos\.sub\(this\.player\.pos\)\.normalize\(\);\n        s\.vel = s\.vel\.add\(dir\.mult\(200 \* dt\)\);\n        this\.player\.vel = this\.player\.vel\.sub\(dir\.mult\(200 \* dt\)\);\n\n        if \(s\.dead\) this\.player\.gainXp\(s\.xpValue\);\n      }\n    }/g, `// Player vs Shape
    for (const p of this.players.values()) {
      const bodyDamage = 400 + p.stats.bodyDamage * 200;
      for (const s of this.shapes) {
        if (!s.dead && !p.dead && p.pos.dist(s.pos) < p.radius + s.radius) {
          s.takeDamage(bodyDamage * dt);
          p.takeDamage(s.damage * dt);
          
          const dir = s.pos.sub(p.pos).normalize();
          s.vel = s.vel.add(dir.mult(200 * dt));
          p.vel = p.vel.sub(dir.mult(200 * dt));

          if (s.dead) p.gainXp(s.xpValue);
        }
      }
    }`);

content = content.replace(/\/\/ Player vs Crasher\n    for \(const c of this\.crashers\) {\n      if \(!c\.dead && !this\.player\.dead && this\.player\.pos\.dist\(c\.pos\) < this\.player\.radius \+ c\.radius\) {\n        c\.takeDamage\(bodyDamage \* dt\);\n        this\.player\.takeDamage\(c\.damage \* dt\);\n        \n        const dir = c\.pos\.sub\(this\.player\.pos\)\.normalize\(\);\n        c\.vel = c\.vel\.add\(dir\.mult\(200 \* dt\)\);\n        this\.player\.vel = this\.player\.vel\.sub\(dir\.mult\(200 \* dt\)\);\n\n        if \(c\.dead\) this\.player\.gainXp\(15\);\n      }\n    }/g, `// Player vs Crasher
    for (const p of this.players.values()) {
      const bodyDamage = 400 + p.stats.bodyDamage * 200;
      for (const c of this.crashers) {
        if (!c.dead && !p.dead && p.pos.dist(c.pos) < p.radius + c.radius) {
          c.takeDamage(bodyDamage * dt);
          p.takeDamage(c.damage * dt);
          
          const dir = c.pos.sub(p.pos).normalize();
          c.vel = c.vel.add(dir.mult(200 * dt));
          p.vel = p.vel.sub(dir.mult(200 * dt));

          if (c.dead) p.gainXp(15);
        }
      }
    }`);

content = content.replace(/\/\/ Bullet vs Player\n      if \(!b\.dead && b\.ownerId !== this\.player\.id && b\.pos\.dist\(this\.player\.pos\) < b\.radius \+ this\.player\.radius\) {\n        b\.isDamaging = true;\n        this\.player\.takeDamage\(b\.damage \* dt\);\n        const dir = this\.player\.pos\.sub\(b\.pos\)\.normalize\(\);\n        this\.player\.vel = this\.player\.vel\.add\(dir\.mult\(100 \* dt\)\);\n      }/g, `// Bullet vs Player
      for (const p of this.players.values()) {
        if (!b.dead && b.ownerId !== p.id && b.pos.dist(p.pos) < b.radius + p.radius) {
          b.isDamaging = true;
          p.takeDamage(b.damage * dt);
          const dir = p.pos.sub(b.pos).normalize();
          p.vel = p.vel.add(dir.mult(100 * dt));
        }
      }`);

content = content.replace(/this\.player\.draw\(this\.ctx\);/g, `for (const p of this.players.values()) p.draw(this.ctx);`);

fs.writeFileSync('src/game/Game.ts', content);
