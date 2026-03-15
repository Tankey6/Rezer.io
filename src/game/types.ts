export function getEffectiveStat(stat: number): number {
  return stat <= 7 ? stat : 7 + (stat - 7) * 0.5;
}

export enum EntityType {
  PLAYER,
  BULLET,
  SHAPE,
  TRAP,
  DRONE,
  CRASHER,
  ENEMY_TANK
}

export enum ShapeType {
  SQUARE,
  TRIANGLE,
  PENTAGON,
  HEXAGON,
  HEPTAGON,
  ALPHA_PENTAGON,
  ROCK
}

export enum TankClass {
  Basic = 'Basic',
  Pounder = 'Pounder',
  Twin = 'Twin',
  Sniper = 'Sniper',
  MachineGun = 'Machine Gun',
  FlankGuard = 'Flank Guard',
  Director = 'Director',
  TripleShot = 'Triple Shot',
  QuadTank = 'Quad Tank',
  TwinFlank = 'Twin Flank',
  Assassin = 'Assassin',
  Destroyer = 'Destroyer',
  Gunner = 'Gunner',
  TriAngle = 'Tri-Angle',
  Triplet = 'Triplet',
  PentaShot = 'Penta Shot',
  Ranger = 'Ranger',
  Annihilator = 'Annihilator',
  Booster = 'Booster',
  Fighter = 'Fighter',
  OctoTank = 'Octo Tank',
  Overseer = 'Overseer',
  Overlord = 'Overlord',
  Manager = 'Manager',
  Trapper = 'Trapper',
  TriTrapper = 'Tri-Trapper',
  MegaTrapper = 'Mega Trapper',
  Hunter = 'Hunter',
  Predator = 'Predator',
  Streamliner = 'Streamliner',
  Sprayer = 'Sprayer',
  Cruiser = 'Cruiser',
  Battleship = 'Battleship',
  Spreadshot = 'Spreadshot',
  Trapezoid = 'Trapezoid',
  Surfer = 'Surfer',
  Fan = 'Fan',
  TripleTwin = 'Triple Twin',
  Auto3 = 'Auto-3',
  Auto5 = 'Auto-5',
  AutoGunner = 'Auto Gunner',
  Commander = 'Commander',
  Overtrapper = 'Overtrapper',
  UltraTrapper = 'Ultra Trapper',
  TriMegaTrapper = 'Tri-Mega Trapper',
  PentaTrapper = 'Penta-Trapper',
  HexaTrapper = 'Hexa Trapper',
  Wark = 'Wark',
  Bulwark = 'Bulwark',
  AutoWark = 'Auto Wark',
  Wamork = 'Wamork',
  Warkle = 'Warkle',
  Warkwark = 'Warkwark',
  Hybrid = 'Hybrid',
  Mega3 = 'Mega-3',
  Auto4 = 'Auto-4',
  Sentinel = 'Sentinel',
  TrapGuard = 'Trap Guard',
  Alloy = 'Alloy',
  GunnerTrapper = 'Gunner Trapper',
  MachineTrapper = 'Machine Trapper',
  GatlingGun = 'Gatling Gun',
  GatlingTrapper = 'Gatling Trapper',
  Bulletstream = 'Bulletstream',
  AutoMachineTrapper = 'Auto-Machine Trapper',
  AutoDestroyer = 'Auto-Destroyer',
  Composition = 'Composition',
  Overpounder = 'Overpounder',
  AutoComposition = 'Auto-Composition',
  DoubleTriple = 'Double Triple',
  Falconer = 'Falconer',
  Stalker = 'Stalker',
  Railgun = 'Railgun',
  Executioner = 'Executioner',
  AutoMegaTrapper = 'Auto-Mega Trapper',
  Howitzer = 'Howitzer',
  Gustav = 'Gustav',
  Locomotive = 'Locomotive',
  AutoHowitzer = 'Auto-Howitzer',
  Mortar = 'Mortar',
  Fogmaker = 'Fogmaker',
  Harvester = 'Harvester',
  Loophole = 'Loophole',
  Nailgun = 'Nailgun',
  Ratfest = 'Ratfest',
  AutoOverseer = 'Auto-Overseer',
  AutoCruiser = 'Auto-Cruiser',
  Shipyard = 'Shipyard',
  BigCheese = 'Big Cheese',
  Ternary = 'Ternary',
  Launcher = 'Launcher',
  Rocketeer = 'Rocketeer',
  Buster = 'Buster',
  Deployer = 'Deployer',
  Hurler = 'Hurler',
  FieldGun = 'Field Gun',
  Occupier = 'Occupier',
  Cluster = 'Cluster',
  Overdrive = 'Overdrive',
  Payload = 'Payload',
  Engineer = 'Engineer',
  Mechanic = 'Mechanic',
  Autoception = 'Autoception',
  TwinLauncher = 'Twin Launcher',
  Hotchkiss = 'Hotchkiss',
  MachineWark = 'Machine Wark',
  Sprinkler = 'Sprinkler',
  Trapception = 'Trapception',
  Mosaic = 'Mosaic',
  Company = 'Company',
  Spawner = 'Spawner',
  Carrier = 'Carrier',
  Factory = 'Factory',
  Overmind = 'Overmind',
  Excavator = 'Excavator',
  Underseer = 'Underseer',
  AutoUnderseer = 'Auto-Underseer',
  Necromancer = 'Necromancer',
  GreyGoo = 'Grey Goo',
  Lich = 'Lich',
  Pythonist = 'Pythonist'
}

export enum CrasherType {
  SMALL,
  MEDIUM,
  LARGE,
  LIGHTNING
}

export type MissileType = TankClass | 'None';
export const MissileType = {
  None: 'None' as MissileType,
  Launcher: TankClass.Launcher as MissileType,
  Rocketeer: TankClass.Rocketeer as MissileType,
  Deployer: TankClass.Deployer as MissileType,
  Hurler: TankClass.Hurler as MissileType,
  FieldGun: TankClass.FieldGun as MissileType,
  Occupier: TankClass.Occupier as MissileType,
  Cluster: TankClass.Cluster as MissileType,
  Trapception: TankClass.TriTrapper as MissileType,
  SpawnerMinion: 'SpawnerMinion' as MissileType,
  FactoryMinion: 'FactoryMinion' as MissileType,
  UnderseerDrone: 'UnderseerDrone' as MissileType
};

export interface BarrelDef {
  angleOffset: number;
  length: number;
  width: number;
  widthEnd?: number;
  xOffset: number;
  yOffset: number;
  posDist?: number;
  posAngle?: number;
  delay: number;
  damageMult: number;
  speedMult: number;
  penMult: number;
  spread: number;
  reloadMult: number;
  bulletSizeMult?: number;
  type?: 'bullet' | 'trap' | 'drone' | 'cruiser_drone';
  maxDrones?: number;
  recoilMult?: number;
  autoAim?: boolean;
  visualOnly?: boolean;
  drawBase?: boolean;
  baseType?: 'circle' | 'triangle' | 'square';
  baseRadius?: number;
  hasAutoTurret?: boolean;
  missileType?: MissileType;
}
