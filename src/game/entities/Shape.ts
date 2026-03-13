import { Entity } from './Entity';
import { Vector } from '../Vector';
import { EntityType, ShapeType } from '../types';
import { darkenColor } from '../utils';

export class Shape extends Entity {
  shapeType: ShapeType;
  angle: number = Math.random() * Math.PI * 2;
  rotSpeed: number = (Math.random() - 0.5) * 2;
  xpValue: number;
  damage: number;
  visualSides: number;
  isAlpha: boolean;

  constructor(pos: Vector, type: ShapeType, isAlpha: boolean = false, sizeMult: number = 1) {
    let radius, color, health, xpValue, damage, visualSides, formulaSides;
    
    if (type === ShapeType.ALPHA_PENTAGON) {
      type = ShapeType.PENTAGON;
      isAlpha = true;
    }

    switch (type) {
      case ShapeType.SQUARE:
        visualSides = 4; formulaSides = 3; radius = 15; color = '#ffe869'; damage = 90; break;
      case ShapeType.TRIANGLE:
        visualSides = 3; formulaSides = 4; radius = 18; color = '#fc7677'; damage = 135; break;
      case ShapeType.PENTAGON:
        visualSides = 5; formulaSides = 5; radius = 25; color = '#768dfc'; damage = 225; break;
      case ShapeType.HEXAGON:
        visualSides = 6; formulaSides = 6; radius = 35; color = '#25dcfc'; damage = 390; break;
      case ShapeType.HEPTAGON:
        visualSides = 7; formulaSides = 7; radius = 45; color = '#fc9b25'; damage = 450; break;
      case ShapeType.ROCK:
        visualSides = 9; formulaSides = 9; radius = 15 * sizeMult; color = '#888888'; damage = 25 * sizeMult; break;
      default:
        visualSides = 4; formulaSides = 3; radius = 15; color = '#ffe869'; damage = 90;
    }
    
    if (type === ShapeType.ROCK) {
      health = sizeMult * 5 * formulaSides * (100 * Math.pow(formulaSides-1, 2));
      xpValue = sizeMult * 100 * Math.pow(formulaSides, 3+(formulaSides)/3);
    } else if (isAlpha) {
      radius *= 3;
      damage *= 3;
      health = 5 * formulaSides * (100 * Math.pow(formulaSides-1, 2));
      xpValue = 100 * Math.pow(formulaSides, 3+(formulaSides)/3);
    } else {
      health = 100 * Math.pow(formulaSides-1, 2);
      xpValue = 100 * Math.pow(formulaSides / 2, 3+(formulaSides)/3);
    }

    super(pos, radius, color, EntityType.SHAPE, health);
    this.shapeType = type;
    this.xpValue = xpValue;
    this.damage = damage;
    this.visualSides = visualSides;
    this.isAlpha = isAlpha;
    
    this.vel = new Vector((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
  }

  update(dt: number) {
    super.update(dt);
    this.angle += this.rotSpeed * dt;
    this.vel = this.vel.mult(0.99); // Friction
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.renderPos.x, this.renderPos.y);
    ctx.rotate(this.angle);
    
    ctx.beginPath();
    let sides = this.visualSides;

    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides;
      const x = Math.cos(a) * this.radius;
      const y = Math.sin(a) * this.radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = darkenColor(this.color);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
    
    if (this.health < this.maxHealth) {
      ctx.fillStyle = '#555555';
      ctx.fillRect(this.renderPos.x - 15, this.renderPos.y + this.radius + 5, 30, 4);
      ctx.fillStyle = '#86c680';
      ctx.fillRect(this.renderPos.x - 15, this.renderPos.y + this.radius + 5, 30 * Math.max(0, this.health / this.maxHealth), 4);
    }
  }
}
