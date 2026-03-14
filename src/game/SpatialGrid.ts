import { Entity } from './entities/Entity.ts';

export class SpatialGrid {
  cellSize: number;
  cells: Map<string, Entity[]>;

  constructor(cellSize: number = 500) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  insert(entity: Entity) {
    const minX = Math.floor((entity.pos.x - entity.radius) / this.cellSize);
    const maxX = Math.floor((entity.pos.x + entity.radius) / this.cellSize);
    const minY = Math.floor((entity.pos.y - entity.radius) / this.cellSize);
    const maxY = Math.floor((entity.pos.y + entity.radius) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(entity);
      }
    }
  }

  getNearby(x: number, y: number, radius: number): Entity[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    const result = new Set<Entity>();

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entity of cell) {
            result.add(entity);
          }
        }
      }
    }

    return Array.from(result);
  }
}
