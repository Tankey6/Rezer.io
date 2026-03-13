export function calculateTotalXp(level: number, currentXp: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(100 * Math.pow(i, 1.5));
  }
  return total + currentXp;
}

export function darkenColor(hex: string, factor: number = 0.75): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.floor(r * factor);
  g = Math.floor(g * factor);
  b = Math.floor(b * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
