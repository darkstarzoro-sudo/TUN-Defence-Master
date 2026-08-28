// ============================================================
// src/utils/attackGifs.js
// Themed GIFs for each P&W attack type and outcome
// ============================================================

const GIFS = {
  GROUND: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/8tpwFKp2LJAAAAAC/tank-war.gif','https://media.tenor.com/ZoIKkD9HATIAAAAC/military-army.gif','https://media.tenor.com/rh9kI6dPtBkAAAAC/tanks-war.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/R7c0j0oJsTMAAAAC/army-soldier.gif','https://media.tenor.com/nY0mFOGEoIIAAAAC/soldier-military.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/h-UHkaHE4F0AAAAC/war-battle.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/fBgZi1MnSTAAAAAC/retreat-running.gif','https://media.tenor.com/BgYFQmKuXPkAAAAC/retreat-army.gif'],
  },
  AIRSTRIKE_INFRA:    { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif','https://media.tenor.com/yp87UoknmTcAAAAC/bombing-explosion.gif'], MODERATE_SUCCESS:['https://media.tenor.com/O5EmtKxCb2gAAAAC/jet-fighter-plane.gif'], PYRRHIC_VICTORY:['https://media.tenor.com/kl_QRpXHdz8AAAAC/plane-crash.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRSTRIKE_SOLDIERS: { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif'], MODERATE_SUCCESS:['https://media.tenor.com/O5EmtKxCb2gAAAAC/jet-fighter-plane.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRSTRIKE_TANKS:    { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRSTRIKE_MONEY:    { IMMENSE_TRIUMPH:['https://media.tenor.com/SIhMRcuNJYcAAAAC/airstrike-bombing.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRSTRIKE_SHIP:     { IMMENSE_TRIUMPH:['https://media.tenor.com/yp87UoknmTcAAAAC/bombing-explosion.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  AIRSTRIKE_AIR:      { IMMENSE_TRIUMPH:['https://media.tenor.com/O5EmtKxCb2gAAAAC/jet-fighter-plane.gif'], UTTER_FAILURE:['https://media.tenor.com/5J3JfGQnkfQAAAAC/jet-shot-down.gif'] },
  NAVAL: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/lz01EbwpsakAAAAC/battleship-naval.gif','https://media.tenor.com/h-k4bVPIBWgAAAAC/warship-navy.gif','https://media.tenor.com/oqiWFkzSIgcAAAAC/ship-explosion.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/lz01EbwpsakAAAAC/battleship-naval.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/oqiWFkzSIgcAAAAC/ship-explosion.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/3CXMJkYQWHYAAAAC/ship-sinking.gif'],
  },
  NAVAL_INFRA: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/lz01EbwpsakAAAAC/battleship-naval.gif','https://media.tenor.com/oqiWFkzSIgcAAAAC/ship-explosion.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/h-k4bVPIBWgAAAAC/warship-navy.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/3CXMJkYQWHYAAAAC/ship-sinking.gif'],
  },
  MISSILE: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/sBcLQMBBV5cAAAAC/missile-launch.gif','https://media.tenor.com/e7FjxSKGGxgAAAAC/missile-strike.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/sBcLQMBBV5cAAAAC/missile-launch.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/e7FjxSKGGxgAAAAC/missile-strike.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif'],
    VDS_INTERCEPTED:  ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif','https://media.tenor.com/Y8dMaAHcbxMAAAAC/missile-defense.gif'],
  },
  NUKE: {
    IMMENSE_TRIUMPH:  ['https://media.tenor.com/9p4U5cDXx2EAAAAC/nuclear-bomb.gif','https://media.tenor.com/YLRkWl_eNjgAAAAC/nuclear-explosion.gif','https://media.tenor.com/y_0K8UB5JpkAAAAC/mushroom-cloud-nuclear.gif','https://media.tenor.com/rOQ49IxW4VEAAAAC/nuke-explosion.gif'],
    MODERATE_SUCCESS: ['https://media.tenor.com/9p4U5cDXx2EAAAAC/nuclear-bomb.gif','https://media.tenor.com/YLRkWl_eNjgAAAAC/nuclear-explosion.gif'],
    PYRRHIC_VICTORY:  ['https://media.tenor.com/y_0K8UB5JpkAAAAC/mushroom-cloud-nuclear.gif'],
    UTTER_FAILURE:    ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif','https://media.tenor.com/Y8dMaAHcbxMAAAAC/missile-defense.gif'],
    VDS_INTERCEPTED:  ['https://media.tenor.com/dMIUxdnIgk4AAAAC/missile-intercepted.gif','https://media.tenor.com/Y8dMaAHcbxMAAAAC/missile-defense.gif'],
  },
  FORTIFY: { default: ['https://media.tenor.com/K-PXjvHF1OAAAAAC/fortify-defense.gif'] },
  PEACE:   { default: ['https://media.tenor.com/TGALe_JeJcAAAAAC/peace-dove.gif'] },
};

function getGif(attackType, successOutcome) {
  const typeGifs = GIFS[attackType];
  if (!typeGifs) return null;
  let pool = typeGifs[successOutcome];
  if (!pool && successOutcome && successOutcome.includes('VITAL_DEFENSE')) pool = typeGifs.VDS_INTERCEPTED;
  if (!pool) pool = typeGifs.default;
  if (!pool) pool = typeGifs.IMMENSE_TRIUMPH;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { getGif, GIFS };
