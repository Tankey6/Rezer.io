export class Vector {
  constructor(public x: number, public y: number) {}
  add(v: Vector) { return new Vector(this.x + v.x, this.y + v.y); }
  sub(v: Vector) { return new Vector(this.x - v.x, this.y - v.y); }
  mult(n: number) { return new Vector(this.x * n, this.y * n); }
  div(n: number) { return new Vector(this.x / n, this.y / n); }
  mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() { const m = this.mag(); return m === 0 ? new Vector(0, 0) : this.div(m); }
  dist(v: Vector) { return this.sub(v).mag(); }
  dot(v: Vector) { return this.x * v.x + this.y * v.y; }
  limit(max: number) {
    const m = this.mag();
    if (m > max) return this.normalize().mult(max);
    return this.copy();
  }
  copy() { return new Vector(this.x, this.y); }
}
