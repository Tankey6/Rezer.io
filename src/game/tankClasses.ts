import { TankClass, BarrelDef } from './types';

export const baseBarrel: BarrelDef = {
  angleOffset: 0, length: 35, width: 20, xOffset: 0, yOffset: 0, delay: 0,
  damageMult: 1, speedMult: 1, penMult: 1, spread: 0, reloadMult: 1, bulletSizeMult: 1
};

function clone(barrel: BarrelDef, overrides: Partial<BarrelDef> = {}): BarrelDef {
  return { ...barrel, ...overrides };
}

// Templates
export function Twin(barrels: BarrelDef[], spread: number = 10): BarrelDef[] {
  const result: BarrelDef[] = [];
  for (const b of barrels) {
    result.push(clone(b, { yOffset: b.yOffset - spread, damageMult: b.damageMult * 0.65 }));
    result.push(clone(b, { yOffset: b.yOffset + spread, delay: b.delay + 0.5, damageMult: b.damageMult * 0.65 }));
  }
  return result;
}

export function Sniper(barrels: BarrelDef[]): BarrelDef[] {
  return barrels.map(b => clone(b, {
    length: b.length + 10,
    damageMult: b.damageMult * 1.5,
    speedMult: b.speedMult * 1.5,
    penMult: b.penMult * 1.5,
    reloadMult: b.reloadMult * 1.5
  }));
}

export function MachineGun(barrels: BarrelDef[]): BarrelDef[] {
  return barrels.map(b => clone(b, {
    widthEnd: b.width * 1.5, // Trapezoid shape
    damageMult: b.damageMult * 0.7,
    spread: b.spread + 0.2,
    reloadMult: b.reloadMult * 0.5
  }));
}

export function Flank(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [...barrels];
  for (const b of barrels) {
    result.push(clone(b, {
      angleOffset: b.angleOffset + Math.PI,
      length: b.length * 0.85
    }));
  }
  return result;
}

export function Pounder(barrels: BarrelDef[]): BarrelDef[] {
  return barrels.map(b => clone(b, {
    width: 25,
    damageMult: b.damageMult * 1.5,
    speedMult: b.speedMult * 0.9,
    penMult: b.penMult * 1.5,
    reloadMult: b.reloadMult * 1.5,
    bulletSizeMult: 1*(25/20)
  }));
}

export function Destroyer(barrels: BarrelDef[]): BarrelDef[] {
  return barrels.map(b => clone(b, {
    width: 32,
    damageMult: b.damageMult * 3,
    speedMult: b.speedMult * 0.8,
    penMult: b.penMult * 3,
    reloadMult: b.reloadMult * 2.5,
    bulletSizeMult: 1*(32/20)
  }));
}

export function Annihilator(barrels: BarrelDef[]): BarrelDef[] {
  return barrels.map(b => clone(b, {
    width: 40, // Width of the tank (radius 15 * 2)
    damageMult: b.damageMult * 4.5,
    speedMult: b.speedMult * 0.7,
    penMult: b.penMult * 4.5,
    reloadMult: b.reloadMult * 3.5,
    bulletSizeMult: 1*(40/20)
  }));
}

export function Triplet(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [];
  for (const b of barrels) {
    // Side barrels first (drawn under)
    result.push(clone(b, { length: b.length - 5, yOffset: b.yOffset - 10, delay: b.delay + 0.5, damageMult: b.damageMult * 0.6 }));
    result.push(clone(b, { length: b.length - 5, yOffset: b.yOffset + 10, delay: b.delay + 0.5, damageMult: b.damageMult * 0.6 }));
    // Middle barrel last (drawn on top)
    result.push(clone(b, { damageMult: b.damageMult * 0.6 }));
  }
  return result;
}

export function TripleShot(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [];
  for (const b of barrels) {
    // Side barrels
    result.push(clone(b, { angleOffset: b.angleOffset + Math.PI / 8, damageMult: b.damageMult * 0.7 }));
    result.push(clone(b, { angleOffset: b.angleOffset - Math.PI / 8, damageMult: b.damageMult * 0.7 }));
    // Middle
    result.push(clone(b, { length: b.length + 3, damageMult: b.damageMult * 0.7 }));
  }
  return result;
}

export function Quad(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [...barrels];
  for (const b of barrels) {
    result.push(clone(b, { angleOffset: b.angleOffset + Math.PI / 2 }));
    result.push(clone(b, { angleOffset: b.angleOffset - Math.PI / 2 }));
    result.push(clone(b, { angleOffset: b.angleOffset + Math.PI }));
  }
  return result;
}

export function Octo(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [];
  for (const b of barrels) {
    for (let i = 0; i < 8; i++) {
      result.push(clone(b, { angleOffset: b.angleOffset + (Math.PI / 4) * i, delay: b.delay + (i % 2 === 0 ? 0 : 0.5) }));
    }
  }
  return result;
}

export function Fogmaker(barrels: BarrelDef[]): BarrelDef[] {
  return Quad(barrels).map(b => clone(b, {
    length: b.length + 5,
    widthEnd: 0,
    damageMult: b.damageMult * 0.8,
    speedMult: b.speedMult * 0.5,
    reloadMult: b.reloadMult * 0.4
  }));
}

export function Overseer(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: Math.PI / 2, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 2, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 2, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ];
}

export function Director(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ];
}

export function Overlord(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: Math.PI / 2, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 2, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: 0, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 })
  ];
}

export function Trapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 })
  ];
}

export function TriTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 2/3, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: -Math.PI * 2/3, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 })
  ];
}

export function MegaTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 30, width: 20, visualOnly: true }),
    clone(baseBarrel, { length: 10, width: 20, widthEnd: 50, xOffset: 30, type: 'trap', reloadMult: 3, damageMult: 4, penMult: 4, bulletSizeMult: 1.5 })
  ];
}

export function AutoMegaTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    ...MegaTrapper(barrels),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ];
}

export function Howitzer(barrels: BarrelDef[]): BarrelDef[] {
  return [
    // Trapezoid (non-firing)
    clone(baseBarrel, { length: 35, width: 20, widthEnd: 30, visualOnly: true }),
    // Firing rectangle (in front of trapezoid)
    clone(baseBarrel, { length: 10, width: 35, xOffset: 35, damageMult: 2.5, speedMult: 1.4, penMult: 2.5, reloadMult: 3, bulletSizeMult: 1*(32/20) })
  ];
}

export function Gustav(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 35, width: 30, widthEnd: 40, visualOnly: true }),
    clone(baseBarrel, { length: 10, width: 40, xOffset: 35, damageMult: 3.5, speedMult: 1.4, penMult: 3.5, reloadMult: 4, bulletSizeMult: 1.5*(32/20) })
  ];
}

export function Locomotive(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 45, width: 20, widthEnd: 30, visualOnly: true }),
    clone(baseBarrel, { length: 10, width: 35, xOffset: 45, damageMult: 2.5, speedMult: 1.8, penMult: 2.5, reloadMult: 3, bulletSizeMult: 1*(32/20) })
  ];
}

export function AutoHowitzer(barrels: BarrelDef[]): BarrelDef[] {
  return [
    ...Howitzer(barrels),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ];
}

export function Mortar(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 35, width: 20, widthEnd: 30, visualOnly: true }),
    clone(baseBarrel, { length: 10, width: 40, xOffset: 35, damageMult: 1.5, speedMult: 1.4, penMult: 1.5, reloadMult: 3, bulletSizeMult: 1.2*(32/20) }),
    clone(baseBarrel, { length: 10, width: 35, xOffset: 45, damageMult: 1.5, speedMult: 1.5, penMult: 1.5, reloadMult: 3, delay: 0.1, bulletSizeMult: 1*(32/20) })
  ];
}

export function Hunter(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 45, width: 20, damageMult: 1.5, speedMult: 1.5, penMult: 1.5, reloadMult: 1.5 }),
    clone(baseBarrel, { length: 40, width: 24, damageMult: 1.5, speedMult: 1.4, penMult: 1.5, reloadMult: 1.5, delay: 0.1 })
  ];
}

export function Predator(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 50, width: 20, damageMult: 1.5, speedMult: 1.6, penMult: 1.5, reloadMult: 1.5 }),
    clone(baseBarrel, { length: 45, width: 24, damageMult: 1.5, speedMult: 1.5, penMult: 1.5, reloadMult: 1.5, delay: 0.1 }),
    clone(baseBarrel, { length: 40, width: 28, damageMult: 1.5, speedMult: 1.4, penMult: 1.5, reloadMult: 1.5, delay: 0.2 })
  ];
}

export function Streamliner(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 55, width: 16, damageMult: 0.3, speedMult: 1.2, penMult: 0.5, reloadMult: 0.2, delay: 0 }),
    clone(baseBarrel, { length: 50, width: 16, damageMult: 0.3, speedMult: 1.2, penMult: 0.5, reloadMult: 0.2, delay: 0.2 }),
    clone(baseBarrel, { length: 45, width: 16, damageMult: 0.3, speedMult: 1.2, penMult: 0.5, reloadMult: 0.2, delay: 0.4 }),
    clone(baseBarrel, { length: 40, width: 16, damageMult: 0.3, speedMult: 1.2, penMult: 0.5, reloadMult: 0.2, delay: 0.6 }),
    clone(baseBarrel, { length: 35, width: 16, damageMult: 0.3, speedMult: 1.2, penMult: 0.5, reloadMult: 0.2, delay: 0.8 })
  ];
}

export function Sprayer(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 50, width: 18, widthEnd: 24, damageMult: 0.7, reloadMult: 0.3, spread: 0.1 }),
    clone(baseBarrel, { length: 40, width: 22, widthEnd: 30, damageMult: 0.7, reloadMult: 0.3, spread: 0.15, delay: 0.5 })
  ];
}

export function GatlingGun(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 45, width: 18, widthEnd: 24, damageMult: 0.6, reloadMult: 0.5, spread: 0.15 }),
    clone(baseBarrel, { length: 35, width: 22, widthEnd: 30, damageMult: 0.6, reloadMult: 0.5, spread: 0.2, delay: 0.5 })
  ];
}

export function GatlingTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 30, width: 15, widthEnd: 22, visualOnly: true }),
    clone(baseBarrel, { length: 15, width: 15, widthEnd: 35, xOffset: 30, type: 'trap', reloadMult: 0.6, damageMult: 0.8, penMult: 0.8, spread: 0.15 }),
    clone(baseBarrel, { length: 25, width: 15, widthEnd: 22, visualOnly: true, delay: 0.5 }),
    clone(baseBarrel, { length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 0.6, damageMult: 0.8, penMult: 0.8, spread: 0.2, delay: 0.5 })
  ];
}

export function Bulletstream(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 55, width: 18, widthEnd: 24, damageMult: 0.5, reloadMult: 0.3, spread: 0.1, delay: 0 }),
    clone(baseBarrel, { length: 45, width: 20, widthEnd: 26, damageMult: 0.5, reloadMult: 0.3, spread: 0.15, delay: 0.33 }),
    clone(baseBarrel, { length: 35, width: 22, widthEnd: 28, damageMult: 0.5, reloadMult: 0.3, spread: 0.2, delay: 0.66 })
  ];
}

export function MachineTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 25, width: 15, widthEnd: 22, visualOnly: true }),
    clone(baseBarrel, { length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 0.7, damageMult: 1, penMult: 1, spread: 0.2 })
  ];
}

export function AutoMachineTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    ...MachineTrapper(barrels),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ];
}

export function Cruiser(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: Math.PI / 4, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 4, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.5 })
  ];
}

export function Battleship(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: Math.PI / 2, length: 25, width: 20, widthEnd: 10, yOffset: 12, type: 'cruiser_drone', maxDrones: 24, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0 }),
    clone(baseBarrel, { angleOffset: Math.PI / 2, length: 25, width: 20, widthEnd: 10, yOffset: -12, type: 'cruiser_drone', maxDrones: 24, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 2, length: 25, width: 20, widthEnd: 10, yOffset: 12, type: 'cruiser_drone', maxDrones: 24, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.25 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 2, length: 25, width: 20, widthEnd: 10, yOffset: -12, type: 'cruiser_drone', maxDrones: 24, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.75 })
  ];
}

export function Spreadshot(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [];
  // 5 pairs of side barrels
  for (let i = 5; i >= 1; i--) {
    result.push(clone(baseBarrel, { angleOffset: (Math.PI / 12) * i, length: 35 - i * 2, width: 12, delay: i * 0.1, damageMult: 0.3, recoilMult: 0.1 }));
    result.push(clone(baseBarrel, { angleOffset: -(Math.PI / 12) * i, length: 35 - i * 2, width: 12, delay: i * 0.1, damageMult: 0.3, recoilMult: 0.1 }));
  }
  // Main barrel
  result.push(clone(baseBarrel, { damageMult: 0.6, recoilMult: 0.2 }));
  return result;
}

export function UltraTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { length: 30, width: 25, visualOnly: true }),
    clone(baseBarrel, { length: 10, width: 25, widthEnd: 60, xOffset: 30, type: 'trap', reloadMult: 4, damageMult: 6, penMult: 6, bulletSizeMult: 2.5 })
  ];
}

export function TriMegaTrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 30, width: 20, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 20, widthEnd: 50, xOffset: 30, type: 'trap', reloadMult: 3, damageMult: 4, penMult: 4, bulletSizeMult: 1.5 }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, length: 30, width: 20, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, length: 20, width: 20, widthEnd: 50, xOffset: 30, type: 'trap', reloadMult: 3, damageMult: 4, penMult: 4, bulletSizeMult: 1.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 2/3, length: 30, width: 20, visualOnly: true }),
    clone(baseBarrel, { angleOffset: -Math.PI * 2/3, length: 20, width: 20, widthEnd: 50, xOffset: 30, type: 'trap', reloadMult: 3, damageMult: 4, penMult: 4, bulletSizeMult: 1.5 })
  ];
}

export function Overtrapper(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 4, reloadMult: 2, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 2/3, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 4, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ];
}

export function Wark(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, yOffset: -10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: -10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, yOffset: 10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: 10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.5 })
  ];
}

export function Bulwark(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 35, width: 20, yOffset: -10, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: 0, length: 35, width: 20, yOffset: 10, delay: 0.5, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, yOffset: -10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: -10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, yOffset: 10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: 10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.5 })
  ];
}

export function DoubleTriple(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: Math.PI / 8, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 8, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: 0, length: 38 }),
    clone(baseBarrel, { angleOffset: Math.PI + Math.PI / 8, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI - Math.PI / 8, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 38 })
  ];
}

export function Commander(barrels: BarrelDef[]): BarrelDef[] {
  return [
    clone(baseBarrel, { angleOffset: 0, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 6, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 6, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 2/3, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 6, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: Math.PI / 3, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.33 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 3, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.66 })
  ];
}

export function PentaTrapper(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [];
  for (const b of barrels) {
    for (let i = 0; i < 5; i++) {
      result.push(clone(b, { 
        angleOffset: b.angleOffset + (Math.PI * 2 / 5) * i, 
        length: 15, 
        width: 15, 
        widthEnd: 35, 
        xOffset: 25, 
        type: 'trap', 
        reloadMult: 1.5, 
        damageMult: 2, 
        penMult: 2 
      }));
      result.push(clone(b, { 
        angleOffset: b.angleOffset + (Math.PI * 2 / 5) * i, 
        length: 25, 
        width: 15, 
        visualOnly: true 
      }));
    }
  }
  result.push(clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true, type: 'bullet' }));
  return result;
}

export function HexaTrapper(barrels: BarrelDef[]): BarrelDef[] {
  const result: BarrelDef[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    result.push(clone(baseBarrel, { angleOffset: angle, length: 25, width: 15, visualOnly: true }));
    result.push(clone(baseBarrel, { angleOffset: angle, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }));
  }
  return result;
}

export function AutoWark(barrels: BarrelDef[]): BarrelDef[] {
  return [
    ...Wark(barrels),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ];
}

export function Wamork(barrels: BarrelDef[]): BarrelDef[] {
  return [
    // Front Triple Shot layout but all trapper cannons
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: Math.PI / 4, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI / 4, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.33 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 4, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: -Math.PI / 4, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.66 })
  ];
}

export function Warkle(barrels: BarrelDef[]): BarrelDef[] {
  return [
    // One normal cannon in front
    clone(baseBarrel, { angleOffset: 0, length: 35, width: 20 }),
    // 2 trappers at the sides with connecting barrels
    clone(baseBarrel, { angleOffset: Math.PI / 4, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI / 4, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 4, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: -Math.PI / 4, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.5 })
  ];
}

export function Warkwark(barrels: BarrelDef[]): BarrelDef[] {
  return [
    // Front Wark set
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, yOffset: -10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: -10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: 0, length: 25, width: 15, yOffset: 10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: 0, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: 10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.5 }),
    // Back Wark set
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, yOffset: -10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: -10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, yOffset: 10, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 15, width: 15, widthEnd: 35, xOffset: 25, yOffset: 10, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2, delay: 0.5 })
  ];
}

export const TANK_CLASSES: Record<TankClass, BarrelDef[]> = {
  [TankClass.Basic]: [baseBarrel],
  [TankClass.Twin]: Twin([baseBarrel]),
  [TankClass.Sniper]: Sniper([baseBarrel]),
  [TankClass.MachineGun]: MachineGun([baseBarrel]),
  [TankClass.FlankGuard]: Flank([baseBarrel]),
  [TankClass.Director]: Director([baseBarrel]),
  
  [TankClass.TripleShot]: TripleShot([baseBarrel]),
  [TankClass.QuadTank]: Quad([baseBarrel]),
  [TankClass.TwinFlank]: Flank(Twin([baseBarrel])),
  [TankClass.Assassin]: [
    ...Sniper(Sniper([baseBarrel])),
    clone(baseBarrel, { length: 15, width: 30, widthEnd: 20, xOffset: 10, visualOnly: true}),
  ],
  [TankClass.Pounder]: Pounder([baseBarrel]),
  [TankClass.Destroyer]: Destroyer(Pounder([baseBarrel])),
  [TankClass.Gunner]: [
    clone(baseBarrel, { length: 30, width: 12, yOffset: -12, delay: 0, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 30, width: 12, yOffset: 12, delay: 0.5, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 35, width: 12, yOffset: -6, delay: 0.25, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 35, width: 12, yOffset: 6, delay: 0.75, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 })
  ],
  [TankClass.TriAngle]: [
    // Back left/right (drawn under)
    clone(baseBarrel, { angleOffset: Math.PI * 5/6, length: 30, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 5/6, length: 30, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    // Front (drawn on top)
    baseBarrel
  ],
  [TankClass.Overseer]: Overseer([baseBarrel]),
  [TankClass.Trapper]: Trapper([baseBarrel]),
  [TankClass.Hunter]: Hunter([baseBarrel]),
  
  [TankClass.Triplet]: Triplet([baseBarrel]),
  [TankClass.PentaShot]: [
    // Outer
    clone(baseBarrel, { angleOffset: Math.PI / 4, length: 25, delay: 0.66, damageMult: 0.6 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 4, length: 25, delay: 0.66, damageMult: 0.6 }),
    // Inner
    clone(baseBarrel, { angleOffset: Math.PI / 8, length: 30, delay: 0.33, damageMult: 0.6 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 8, length: 30, delay: 0.33, damageMult: 0.6 }),
    // Center
    clone(baseBarrel, { damageMult: 0.6 })
  ],
  [TankClass.Spreadshot]: Spreadshot([baseBarrel]),
  [TankClass.Ranger]: [
    ...Sniper(Sniper(Sniper([baseBarrel]))),
    clone(baseBarrel, { length: 15, width: 30, widthEnd: 20, xOffset: 10, visualOnly: true}),
  ],
  [TankClass.Annihilator]: Annihilator(Pounder([baseBarrel])),
  [TankClass.Booster]: [
    // Back outer (smaller cannons)
    clone(baseBarrel, { angleOffset: Math.PI * 6/8, length: 22.5, width: 12, yOffset: -5, delay: 0.75, damageMult: 0.2, recoilMult: 1.2 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 6/8, length: 22.5, width: 12, yOffset: 5, delay: 0.75, damageMult: 0.2, recoilMult: 1.2 }),
    // Back inner
    clone(baseBarrel, { angleOffset: Math.PI * 7/8, length: 27.5, yOffset: -5, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 7/8, length: 27.5, yOffset: 5, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    // Front
    baseBarrel
  ],
  [TankClass.Fighter]: [
    // Side
    clone(baseBarrel, { angleOffset: Math.PI / 2, length: 30, delay: 0.5, damageMult: 0.8 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 2, length: 30, delay: 0.5, damageMult: 0.8 }),
    // Back
    clone(baseBarrel, { angleOffset: Math.PI * 5/6, length: 27.5, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 5/6, length: 27.5, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    // Front
    baseBarrel
  ],
  [TankClass.Trapezoid]: [
    // Back
    clone(baseBarrel, { angleOffset: Math.PI * 5/6, length: 30, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 5/6, length: 30, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    // Twin Front
    clone(baseBarrel, { yOffset: -10, damageMult: 0.65 }),
    clone(baseBarrel, { yOffset: 10, delay: 0.5, damageMult: 0.65 })
  ],
  [TankClass.Surfer]: [
    // Side Cruiser Drones
    clone(baseBarrel, { angleOffset: Math.PI / 2, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0, recoilMult: 0 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 2, length: 25, width: 20, widthEnd: 10, type: 'cruiser_drone', maxDrones: 12, reloadMult: 0.5, damageMult: 0.5, penMult: 0.5, delay: 0.5, recoilMult: 0 }),
    // Back
    clone(baseBarrel, { angleOffset: Math.PI * 5/6, length: 30, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 5/6, length: 30, delay: 0.5, damageMult: 0.2, recoilMult: 2.5 }),
    // Front
    baseBarrel
  ],
  [TankClass.Fan]: [
    // 7 back cannons (spreadshot layout facing backwards)
    clone(baseBarrel, { angleOffset: Math.PI + (Math.PI / 8) * 3, length: 25, width: 12, delay: 0.3, damageMult: 0.4, recoilMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI - (Math.PI / 8) * 3, length: 25, width: 12, delay: 0.3, damageMult: 0.4, recoilMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI + (Math.PI / 8) * 2, length: 28, width: 12, delay: 0.2, damageMult: 0.4, recoilMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI - (Math.PI / 8) * 2, length: 28, width: 12, delay: 0.2, damageMult: 0.4, recoilMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI + (Math.PI / 8) * 1, length: 31, width: 12, delay: 0.1, damageMult: 0.4, recoilMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI - (Math.PI / 8) * 1, length: 31, width: 12, delay: 0.1, damageMult: 0.4, recoilMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 34, width: 12, delay: 0, damageMult: 0.4, recoilMult: 0.5 }),
    // Front
    baseBarrel
  ],
  [TankClass.OctoTank]: Octo([baseBarrel]),
  [TankClass.Harvester]: [
    ...Quad([baseBarrel]),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 1/4, autoAim: true, delay: 0 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 3/4, autoAim: true, delay: 0.25 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 5/4, autoAim: true, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 7/4, autoAim: true, delay: 0.75 }),
  ],
  [TankClass.Overlord]: Overlord([baseBarrel]),
  [TankClass.Manager]: [
    clone(baseBarrel, { angleOffset: 0, length: 30, width: 15, widthEnd: 40, type: 'drone', maxDrones: 8, reloadMult: 1.5, damageMult: 1.5, penMult: 1.5 })
  ],
  [TankClass.TriTrapper]: TriTrapper([baseBarrel]),
  [TankClass.MegaTrapper]: MegaTrapper([baseBarrel]),
  [TankClass.Loophole]: [
    clone(baseBarrel, { length: 45, }),
    ...MegaTrapper([baseBarrel]),
  ],
  [TankClass.Predator]: Predator([baseBarrel]),
  [TankClass.Streamliner]: Streamliner([baseBarrel]),
  [TankClass.Sprayer]: Sprayer([baseBarrel]),
  [TankClass.GatlingGun]: GatlingGun([baseBarrel]),
  [TankClass.GatlingTrapper]: GatlingTrapper([baseBarrel]),
  [TankClass.Bulletstream]: Bulletstream([baseBarrel]),
  [TankClass.AutoMachineTrapper]: AutoMachineTrapper([baseBarrel]),
  [TankClass.AutoMegaTrapper]: AutoMegaTrapper([baseBarrel]),
  [TankClass.Howitzer]: Howitzer([baseBarrel]),
  [TankClass.Gustav]: Gustav([baseBarrel]),
  [TankClass.Locomotive]: Locomotive([baseBarrel]),
  [TankClass.AutoHowitzer]: AutoHowitzer([baseBarrel]),
  [TankClass.Mortar]: Mortar([baseBarrel]),
  [TankClass.Cruiser]: Cruiser([baseBarrel]),
  [TankClass.Battleship]: Battleship([baseBarrel]),
  [TankClass.TripleTwin]: [
    clone(baseBarrel, { angleOffset: 0, yOffset: -10, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: 0, yOffset: 10, delay: 0.5, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, yOffset: -10, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: Math.PI * 2/3, yOffset: 10, delay: 0.5, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: Math.PI * 4/3, yOffset: -10, damageMult: 0.65 }),
    clone(baseBarrel, { angleOffset: Math.PI * 4/3, yOffset: 10, delay: 0.5, damageMult: 0.65 })
  ],
  [TankClass.Auto3]: [
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: 0, autoAim: true, delay: 0 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 2/3, autoAim: true, delay: 0.33 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 4/3, autoAim: true, delay: 0.66 })
  ],
  [TankClass.Auto5]: [
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: 0, autoAim: true, delay: 0 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 2/5, autoAim: true, delay: 0.2 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 4/5, autoAim: true, delay: 0.4 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 6/5, autoAim: true, delay: 0.6 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 8/5, autoAim: true, delay: 0.8 })
  ],
  [TankClass.AutoGunner]: [
    clone(baseBarrel, { length: 30, width: 12, yOffset: -12, delay: 0, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 30, width: 12, yOffset: 12, delay: 0.5, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 35, width: 12, yOffset: -6, delay: 0.25, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 35, width: 12, yOffset: 6, delay: 0.75, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ],
  [TankClass.Commander]: Commander([baseBarrel]),
  [TankClass.Overtrapper]: Overtrapper([baseBarrel]),
  [TankClass.UltraTrapper]: UltraTrapper([baseBarrel]),
  [TankClass.TriMegaTrapper]: TriMegaTrapper([baseBarrel]),
  [TankClass.PentaTrapper]: PentaTrapper([baseBarrel]),
  [TankClass.HexaTrapper]: HexaTrapper([baseBarrel]),
  [TankClass.Wark]: Wark([baseBarrel]),
  [TankClass.Bulwark]: Bulwark([baseBarrel]),
  [TankClass.AutoWark]: AutoWark([baseBarrel]),
  [TankClass.Wamork]: Wamork([baseBarrel]),
  [TankClass.Warkle]: Warkle([baseBarrel]),
  [TankClass.Warkwark]: Warkwark([baseBarrel]),
  [TankClass.Hybrid]: [
    ...Destroyer([baseBarrel]),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, widthEnd: 30, type: 'drone', maxDrones: 2, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ],
  [TankClass.Composition]: [
    ...Pounder([baseBarrel]),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, widthEnd: 30, type: 'drone', maxDrones: 2, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ],
  [TankClass.Overpounder]: [
    ...Pounder([baseBarrel]),
    clone(baseBarrel, { angleOffset: Math.PI * 5/6, length: 25, width: 15, widthEnd: 30, type: 'drone', maxDrones: 2, reloadMult: 2, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: -Math.PI * 5/6, length: 25, width: 15, widthEnd: 30, type: 'drone', maxDrones: 2, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ],
  [TankClass.AutoComposition]: [
    ...Pounder([baseBarrel]),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, widthEnd: 30, type: 'drone', maxDrones: 2, reloadMult: 2, damageMult: 1.5, penMult: 1.5 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ],
  [TankClass.Mega3]: [
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 16, posDist: 15, posAngle: 0, autoAim: true, damageMult: 1.5, bulletSizeMult: 1.5, reloadMult: 1.5, delay: 0 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 16, posDist: 15, posAngle: Math.PI * 2/3, autoAim: true, damageMult: 1.5, bulletSizeMult: 1.5, reloadMult: 1.5, delay: 0.33 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 16, posDist: 15, posAngle: Math.PI * 4/3, autoAim: true, damageMult: 1.5, bulletSizeMult: 1.5, reloadMult: 1.5, delay: 0.66 })
  ],
  [TankClass.Auto4]: [
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: 0, autoAim: true, yOffset: -5, baseRadius: 12, delay: 0 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: 0, autoAim: true, yOffset: 5, delay: 0.5, drawBase: false }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI / 2, autoAim: true, yOffset: -5, baseRadius: 12, delay: 0.25 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI / 2, autoAim: true, yOffset: 5, delay: 0.75, drawBase: false }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI, autoAim: true, yOffset: -5, baseRadius: 12, delay: 0.5 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI, autoAim: true, yOffset: 5, delay: 0, drawBase: false }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 3/2, autoAim: true, yOffset: -5, baseRadius: 12, delay: 0.75 }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 3/2, autoAim: true, yOffset: 5, delay: 0.25, drawBase: false })
  ],
  [TankClass.Sentinel]: [
    ...TriTrapper([baseBarrel]),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: 0, autoAim: true }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 2/3, autoAim: true }),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 15, posAngle: Math.PI * 4/3, autoAim: true })
  ],
  [TankClass.TrapGuard]: [
    clone(baseBarrel, { angleOffset: 0, length: 35, width: 15 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 })
  ],
  [TankClass.Alloy]: [
    ...TriTrapper([baseBarrel]),
    clone(baseBarrel, { angleOffset: Math.PI / 3, length: 35, width: 15 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 35, width: 15 }),
    clone(baseBarrel, { angleOffset: -Math.PI / 3, length: 35, width: 15 })
  ],
  [TankClass.GunnerTrapper]: [
    clone(baseBarrel, { length: 35, width: 12, yOffset: -6, delay: 0, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { length: 35, width: 12, yOffset: 6, delay: 0.5, damageMult: 0.4, bulletSizeMult: 0.6, reloadMult: 0.5 }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, visualOnly: true }),
    clone(baseBarrel, { angleOffset: Math.PI, length: 15, width: 15, widthEnd: 35, xOffset: 25, type: 'trap', reloadMult: 1.5, damageMult: 2, penMult: 2 })
  ],
  [TankClass.MachineTrapper]: MachineTrapper([baseBarrel]),
  [TankClass.AutoDestroyer]: [
    ...Destroyer([baseBarrel]),
    clone(baseBarrel, { angleOffset: 0, length: 20, width: 12, posDist: 0, posAngle: 0, autoAim: true })
  ],
  [TankClass.Fogmaker]: Fogmaker([baseBarrel]),
  [TankClass.DoubleTriple]: DoubleTriple([baseBarrel]),
  [TankClass.Falconer]: [
    ...Hunter([baseBarrel]),
    clone(baseBarrel, { angleOffset: Math.PI, length: 25, width: 15, widthEnd: 30, type: 'drone', maxDrones: 2, reloadMult: 2, damageMult: 1.5, penMult: 1.5 })
  ],
  [TankClass.Stalker]: [
    ...Sniper(Sniper(Sniper([baseBarrel]))),
    clone(baseBarrel, { length: 55, width: 30, widthEnd: 20, xOffset: 10, visualOnly: true}),
  ],
  [TankClass.Railgun]: [
    clone(baseBarrel, { length: 50, width: 20, visualOnly: true, xOffset: -5 }),
    clone(baseBarrel, { length: 55, width: 10, damageMult: 12, speedMult: 3, penMult: 3, reloadMult: 10, bulletSizeMult: 0.5 }),
    clone(baseBarrel, { length: 15, width: 30, widthEnd: 20, xOffset: 10, visualOnly: true}),
  ],
   [TankClass.Executioner]: [
    ...Sniper(Hunter([baseBarrel])),
    clone(baseBarrel, { length: 15, width: 35, widthEnd: 20, xOffset: 10, visualOnly: true}),
  ]
};

export const UPGRADE_PATHS: Partial<Record<TankClass, TankClass[]>> = {
  [TankClass.Basic]: [TankClass.Twin, TankClass.Sniper, TankClass.MachineGun, TankClass.FlankGuard, TankClass.Pounder, TankClass.Director, TankClass.Trapper],
  [TankClass.Twin]: [TankClass.TripleShot, TankClass.QuadTank, TankClass.TwinFlank, TankClass.Wark],
  [TankClass.Sniper]: [TankClass.Assassin, TankClass.Hunter, TankClass.Howitzer],
  [TankClass.MachineGun]: [TankClass.Gunner, TankClass.MachineTrapper, TankClass.GatlingGun],
  [TankClass.Pounder]: [TankClass.Destroyer, TankClass.MegaTrapper, TankClass.Composition, TankClass.Howitzer],
  [TankClass.FlankGuard]: [TankClass.TriAngle, TankClass.QuadTank, TankClass.TwinFlank, TankClass.Auto3, TankClass.TriTrapper, TankClass.TrapGuard],
  [TankClass.Director]: [TankClass.Overseer, TankClass.Cruiser, TankClass.Manager],
  [TankClass.Trapper]: [TankClass.TriTrapper, TankClass.MegaTrapper, TankClass.Overtrapper, TankClass.Wark, TankClass.TrapGuard, TankClass.MachineTrapper],
  
  [TankClass.TripleShot]: [TankClass.Triplet, TankClass.PentaShot, TankClass.Spreadshot, TankClass.DoubleTriple, TankClass.Wamork],
  [TankClass.QuadTank]: [TankClass.OctoTank, TankClass.Auto5, TankClass.Fogmaker, TankClass.Harvester, TankClass.Alloy],
  [TankClass.TwinFlank]: [TankClass.OctoTank, TankClass.Battleship, TankClass.Trapezoid, TankClass.TripleTwin, TankClass.Bulwark, TankClass.DoubleTriple, TankClass.Warkwark],
  [TankClass.Assassin]: [TankClass.Ranger, TankClass.Stalker, TankClass.Executioner, TankClass.Railgun, TankClass.Locomotive],
  [TankClass.Overseer]: [TankClass.Overlord, TankClass.Overtrapper, TankClass.Commander],
  [TankClass.Cruiser]: [TankClass.Battleship, TankClass.Commander],
  [TankClass.Hunter]: [TankClass.Predator, TankClass.Streamliner, TankClass.Falconer, TankClass.Executioner, TankClass.Mortar],
  [TankClass.TriTrapper]: [TankClass.TriMegaTrapper, TankClass.PentaTrapper, TankClass.HexaTrapper, TankClass.Sentinel, TankClass.Alloy],
  [TankClass.MegaTrapper]: [TankClass.UltraTrapper, TankClass.TriMegaTrapper, TankClass.Loophole],
  [TankClass.Destroyer]: [TankClass.Annihilator, TankClass.Hybrid, TankClass.UltraTrapper, TankClass.AutoDestroyer, TankClass.Gustav],
  [TankClass.Composition]: [TankClass.Hybrid, TankClass.Overpounder, TankClass.AutoComposition],
  [TankClass.Gunner]: [TankClass.Streamliner, TankClass.AutoGunner, TankClass.GunnerTrapper],
  [TankClass.TriAngle]: [TankClass.Booster, TankClass.Fighter, TankClass.Trapezoid, TankClass.Surfer, TankClass.Fan],
  [TankClass.Auto3]: [TankClass.Auto5, TankClass.AutoGunner, TankClass.Mega3, TankClass.Auto4, TankClass.Sentinel, TankClass.Harvester],
  [TankClass.Wark]: [TankClass.Bulwark, TankClass.AutoWark, TankClass.Wamork, TankClass.Warkle, TankClass.Warkwark],
  [TankClass.TrapGuard]: [TankClass.Bulwark, TankClass.Alloy, TankClass.GunnerTrapper],
  [TankClass.MachineTrapper]: [TankClass.GatlingTrapper, TankClass.AutoMachineTrapper],
  [TankClass.GatlingGun]: [TankClass.Sprayer, TankClass.GatlingTrapper, TankClass.Bulletstream],
  [TankClass.Howitzer]: [TankClass.Gustav, TankClass.Locomotive, TankClass.AutoHowitzer, TankClass.Mortar]
};

export const FOV_MULT: Record<number, TankClass[]> = {
  1.1: [
    TankClass.Director, TankClass.Trapper, TankClass.TriTrapper, TankClass.MegaTrapper,
    TankClass.Overtrapper, TankClass.UltraTrapper, TankClass.TriMegaTrapper, TankClass.PentaTrapper,
    TankClass.HexaTrapper, TankClass.Wark, TankClass.Bulwark, TankClass.AutoWark,
    TankClass.Wamork, TankClass.Warkle, TankClass.Warkwark, TankClass.GatlingGun,
    TankClass.GatlingTrapper, TankClass.Bulletstream, TankClass.AutoMachineTrapper, TankClass.TrapGuard,
    TankClass.Alloy, TankClass.GunnerTrapper, TankClass.MachineTrapper, TankClass.Sentinel,
    TankClass.AutoDestroyer, TankClass.Composition, TankClass.Overpounder, TankClass.AutoComposition,
    TankClass.Sprayer, TankClass.AutoMegaTrapper
  ],
  1.25: [
    TankClass.Sniper, TankClass.Hunter, TankClass.Streamliner, TankClass.Overseer,
    TankClass.Overlord, TankClass.Manager, TankClass.Commander, TankClass.Battleship,
    TankClass.Cruiser, TankClass.Falconer, TankClass.Howitzer,
    TankClass.Gustav, TankClass.AutoHowitzer, TankClass.Mortar
  ],
  1.4: [
    TankClass.Assassin, TankClass.Stalker, TankClass.Railgun, TankClass.Predator,
    TankClass.Executioner, TankClass.Locomotive
  ],
  1.6: [TankClass.Ranger]
};

export function getFovMult(tankClass: TankClass): number {
  for (const [mult, tanks] of Object.entries(FOV_MULT)) {
    if (tanks.includes(tankClass)) {
      return parseFloat(mult);
    }
  }
  return 1;
}
