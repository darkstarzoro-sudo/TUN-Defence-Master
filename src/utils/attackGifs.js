// ============================================================
// src/utils/attackGifs.js
// Themed GIFs for each P&W attack type.
//
// IMPORTANT: every URL below was individually verified by fetching
// its source page and reading the real og:image metadata — these are
// NOT guessed/fabricated links. An earlier version of this file used
// invented media.tenor.com URLs that didn't actually exist, which is
// why GIFs weren't rendering (they were dead links). Do not add new
// GIF URLs to this file without verifying them the same way (fetch
// the gif's page, confirm a working og:image / direct file link).
//
// Canonical type keys match the real P&W GraphQL `AttackType` enum:
// GROUND, AIRVINFRA, AIRVSOLDIERS, AIRVTANKS, AIRVMONEY, AIRVSHIPS,
// AIRVAIR, NAVAL, MISSILE, MISSILEFAIL, NUKE, NUKEFAIL, FORTIFY,
// PEACE, VICTORY, ALLIANCELOOT.
// Old AIRSTRIKE_*/NAVAL_INFRA key names are kept as aliases below so
// nothing breaks if the API naming ever differs from what's confirmed.
//
// NOTE ON SCOPE: rather than fabricate dozens of unverified success/
// failure variants, each attack type below maps to ONE verified GIF
// (two for MISSILE/NUKE — a launch GIF for success, an interception
// GIF for failure). If you want more variety, the safest approach is
// to host your own curated set (e.g. on imgbb) and paste direct links
// into GIFS below — just make sure each link ends in a real, working
// file, not a webpage.
// ============================================================

const GROUND_GIF     = 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZXQwOTdodnJyOTM2eXVmb2ZtMzVpM2t5eThkM2Zya25na2xueWhjayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JxyYDDwOH9Gqks20cw/giphy.gif'; // tank/explosion (giphy.com/gifs/SecondFront-tank-wargame-second-front-JxyYDDwOH9Gqks20cw)
const DOGFIGHT_GIF   = 'https://media1.tenor.com/m/MZM5pEt4TFYAAAAd/dogfight-air-to-air-combat.gif'; // tenor.com/view/dogfight-air-to-air-combat-gi-joe-a-real-american-hero-gif-3572262307238530134
const NAVAL_GIF      = 'https://gifdb.com/images/branded/high/warship-exploding-y7mhdw26ojbpek11.gif'; // gifdb.com/gif/warship-exploding-y7mhdw26ojbpek11.html
const MISSILE_GIF    = 'https://media1.tenor.com/m/GPWtOu0xdu8AAAAd/press-missile.gif'; // tenor.com/view/press-missile-launch-gif-17462808
const NUKE_GIF       = 'https://media1.tenor.com/m/RlvO_fx80XwAAAAd/nuke-nuclear-bomb.gif'; // tenor.com/view/nuke-nuclear-bomb-mushroom-clouds-explosion-boom-gif-16362236
const INTERCEPTED_GIF= 'https://media1.tenor.com/m/TV9tSJQ77bcAAAAd/patriot-defence-system.gif'; // tenor.com/view/patriot-defence-system-gif-5575295022199991735
const FORTIFY_GIF    = 'https://media1.tenor.com/m/Ie-Q1Q_7fmcAAAAd/pour-hot-oil-medieval-castle-defence.gif'; // tenor.com/view/pour-hot-oil-medieval-castle-defence-gif-27003537
const PEACE_GIF      = 'https://media1.tenor.com/m/ObWFgyjIM4QAAAAd/peace-dove.gif'; // tenor.com/view/peace-dove-happy-national-peace-day-fly-gif-15080843

const GIFS = {
  GROUND:       { default: [GROUND_GIF] },
  AIRVINFRA:    { default: [DOGFIGHT_GIF] },
  AIRVSOLDIERS: { default: [DOGFIGHT_GIF] },
  AIRVTANKS:    { default: [DOGFIGHT_GIF] },
  AIRVMONEY:    { default: [DOGFIGHT_GIF] },
  AIRVSHIPS:    { default: [DOGFIGHT_GIF] },
  AIRVAIR:      { default: [DOGFIGHT_GIF] },
  NAVAL:        { default: [NAVAL_GIF] },
  MISSILE:      { UTTER_FAILURE: [INTERCEPTED_GIF], default: [MISSILE_GIF] },
  MISSILEFAIL:  { default: [INTERCEPTED_GIF] },
  NUKE:         { UTTER_FAILURE: [INTERCEPTED_GIF], default: [NUKE_GIF] },
  NUKEFAIL:     { default: [INTERCEPTED_GIF] },
  FORTIFY:      { default: [FORTIFY_GIF] },
  PEACE:        { default: [PEACE_GIF] },
  VICTORY:      { default: [GROUND_GIF] },
  ALLIANCELOOT: { default: [GROUND_GIF] },
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
  if (!pool) pool = typeGifs.default;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { getGif, GIFS, normalizeAttackType };
