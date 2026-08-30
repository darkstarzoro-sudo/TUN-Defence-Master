// ============================================================
// src/utils/attackGifs.js
// Themed GIFs for each P&W attack type and outcome.
//
// Canonical keys match the real P&W GraphQL `AttackType` enum:
// GROUND, AIRVINFRA, AIRVSOLDIERS, AIRVTANKS, AIRVMONEY, AIRVSHIPS,
// AIRVAIR, NAVAL, MISSILE, MISSILEFAIL, NUKE, NUKEFAIL, FORTIFY,
// PEACE, VICTORY, ALLIANCELOOT.
// Old AIRSTRIKE_*/NAVAL_INFRA keys are kept as aliases below so
// nothing breaks if the API naming ever differs from what's confirmed.
// ============================================================

const GIFS = {
  GROUND: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/8tpwFKp2LJAAAAAC/tank-war.gif','https://media.tenor.com/ZoIKkD9HATIAAAAC/military-army.gif','https://media.tenor.com/rh9kI6dPtBkAAAAC/tanks-war.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/R7c0j0oJsTMAAAAC/army-soldier.gif','https://media.tenor.com/nY0mFOGEoIIAAAAC/soldier-military.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/h-UHkaHE4F0AAAAC/war-battle.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/fBgZi1MnSTAAAAAC/retreat-running.gif','https://media.tenor.com/BgYFQmKuXPkAAAAC/retreat-army.gif'],
  },
  AIRVINFRA:    { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif','https://media.tenor.com/yp87UoknmTcAAAAC/bombing-explosion.gif'], MODERATE_SUCCESS:['https://media.tenor.com/O5EmtKxCb2gAAAAC/jet-fighter-plane.gif'], PYRRHIC_VICTORY:['https://media.tenor.com/kl_QRpXHdz8AAAAC/plane-crash.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRVSOLDIERS: { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif'], MODERATE_SUCCESS:['https://media.tenor.com/O5EmtKxCb2gAAAAC/jet-fighter-plane.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRVTANKS:    { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRVMONEY:    { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRVSHIPS:    { IMMENSE_TRIUMPH:['https://media.tenor.com/yp87UoknmTcAAAAC/bombing-explosion.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRVAIR:      { IMMENSE_TRIUMPH:['https://media.tenor.com/O5EmtKxCb2gAAAAC/jet-fighter-plane.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  NAVAL: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/lz01EbwpsakAAAAC/battleship-naval.gif','https://media.tenor.com/h-k4bVPIBWgAAAAC/warship-navy.gif','https://media.tenor.com/oqiWFkzSIgcAAAAC/ship-explosion.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/lz01EbwpsakAAAAC/battleship-naval.gif','https://media.tenor.com/h-k4bVPIBWgAAAAC/warship-navy.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/oqiWFkzSIgcAAAAC/ship-explosion.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/3CXMJkYQWHYAAAAC/ship-sinking.gif'],
  },
  MISSILE: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/sBcLQMBBV5cAAAAC/missile-launch.gif','https://media.tenor.com/e7FjxSKGGxgAAAAC/missile-strike.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/sBcLQMBBV5cAAAAC/missile-launch.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/e7FjxSKGGxgAAAAC/missile-strike.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif'],
    default:          ['https://media.tenor.com/sBcLQMBBV5cAAAAC/missile-launch.gif'],
  },
  MISSILEFAIL: { default: ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif','https://media.tenor.com/Y8dMaAHcbxMAAAAC/missile-defense.gif'] },
  NUKE: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/9p4U5cDXx2EAAAAC/nuclear-bomb.gif','https://media.tenor.com/YLRkWl_eNjgAAAAC/nuclear-explosion.gif','https://media.tenor.com/y_0K8UB5JpkAAAAC/mushroom-cloud-nuclear.gif','https://media.tenor.com/rOQ49IxW4VEAAAAC/nuke-explosion.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/9p4U5cDXx2EAAAAC/nuclear-bomb.gif','https://media.tenor.com/YLRkWl_eNjgAAAAC/nuclear-explosion.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/y_0K8UB5JpkAAAAC/mushroom-cloud-nuclear.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif'],
    default:          ['https://media.tenor.com/9p4U5cDXx2EAAAAC/nuclear-bomb.gif'],
  },
  NUKEFAIL: { default: ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif','https://media.tenor.com/Y8dMaAHcbxMAAAAC/missile-defense.gif'] },
  FORTIFY:      { default: ['https://media.tenor.com/K-PXjvHF1OAAAAAC/fortify-defense.gif'] },
  PEACE:        { default: ['https://media.tenor.com/TGALe_JeJcAAAAAC/peace-dove.gif'] },
  VICTORY:      { default: ['https://media.tenor.com/8tpwFKp2LJAAAAAC/tank-war.gif'] },
  ALLIANCELOOT: { default: ['https://media.tenor.com/yp87UoknmTcAAAAC/bombing-explosion.gif'] },
};

// Old key names -> canonical enum key, kept so nothing breaks if the API
// naming differs from what's confirmed above.
const TYPE_ALIASES = {
  AIRSTRIKE_INFRA: 'AIRVINFRA', AIRSTRIKE_SOLDIERS: 'AIRVSOLDIERS', AIRSTRIKE_TANKS: 'AIRVTANKS',
  AIRSTRIKE_MONEY: 'AIRVMONEY', AIRSTRIKE_SHIP: 'AIRVSHIPS', AIRSTRIKE_AIR: 'AIRVAIR',
  NAVAL_INFRA: 'NAVAL',
};
function normalizeAttackType(type) {
  return TYPE_ALIASES[type] || type;
}

function getGif(attackType, successOutcome) {
  const type = normalizeAttackType(attackType);
  const typeGifs = GIFS[type];
  if (!typeGifs) return null;
  const key = successOutcome==null ? '' : String(successOutcome); // defensive: success can be an Int code, not a string
  let pool = typeGifs[key];
  if (!pool && key.includes('VITAL_DEFENSE')) pool = typeGifs.VDS_INTERCEPTED;
  if (!pool) pool = typeGifs.default;
  if (!pool) pool = typeGifs.IMMENSE_TRIUMPH;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { getGif, GIFS, normalizeAttackType };
