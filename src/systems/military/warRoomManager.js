// ============================================================
// src/systems/military/warRoomManager.js
// Fixed: removed att_map/def_map (not in P&W API)
// MAP shown as N/A — fetch from war page directly
// ============================================================

const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query, run, queryOne } = require('../../utils/database');
const { pwQuery } = require('../../utils/pwApi');
const { getGif } = require('../../utils/attackGifs');
const logger = require('../../utils/logger');

function buildWarCard(war, ourMember, enemyNation, assignedTo=null, isCounter=false, counterDetail=null) {
  const color   = war.isOurAttack ? 0x3498db : 0xe74c3c;
  const typeTag = isCounter ? '🔄 **COUNTER WAR**' : war.isOurAttack ? '⚔️ **OFFENSIVE WAR**' : '🛡️ **DEFENSIVE WAR**';

  return new EmbedBuilder()
    .setTitle(`${typeTag} — vs ${enemyNation?.nation_name||'Unknown'}`)
    .setColor(color)
    .setDescription((isCounter&&counterDetail?`✅ _${counterDetail}_\n\n`:'')+`[View War](https://politicsandwar.com/nation/war/timeline/war=${war.id})`)
    .addFields(
      {
        name: `🛡️ Our Member — ${ourMember?.nation_name||'Unknown'}`,
        value: [
          `⭐ NS: **${Math.round(ourMember?.score||0).toLocaleString()}** | 🏙️ Cities: **${ourMember?.num_cities||'?'}**`,
          `👮 ${(ourMember?.soldiers||0).toLocaleString()} | 🚗 ${(ourMember?.tanks||0).toLocaleString()} | ✈️ ${ourMember?.aircraft||0} | 🚢 ${ourMember?.ships||0}`,
          `🚀 ${ourMember?.missiles||0} | ☢️ ${ourMember?.nukes||0} | 🕵️ ${ourMember?.spies||0}`,
          `❤️ Resistance: **${war.ourResistance??'?'}/100**`,
        ].join('\n'),
        inline: false,
      },
      {
        name: `⚔️ Enemy — [${enemyNation?.nation_name||'Unknown'}](https://politicsandwar.com/nation/id=${enemyNation?.id}) (${enemyNation?.alliance?.name||'None'})`,
        value: [
          `⭐ NS: **${Math.round(enemyNation?.score||0).toLocaleString()}** | 🏙️ Cities: **${enemyNation?.num_cities||'?'}**`,
          `👮 ${(enemyNation?.soldiers||0).toLocaleString()} | 🚗 ${(enemyNation?.tanks||0).toLocaleString()} | ✈️ ${enemyNation?.aircraft||0} | 🚢 ${enemyNation?.ships||0}`,
          `🚀 ${enemyNation?.missiles||0} | ☢️ ${enemyNation?.nukes||0} | 🕵️ ${enemyNation?.spies||0}`,
          `❤️ Resistance: **${war.enemyResistance??'?'}/100**`,
        ].join('\n'),
        inline: false,
      },
      { name: '⏳ War Status', value: `Turns Left: **${war.turnsleft??'?'}** | War ID: \`${war.id}\`\n_MAP values — check war page_`, inline: false },
    )
    .setTimestamp()
    .setFooter({ text: assignedTo?`Director: @${assignedTo}`:'No director — click Claim to take command' });
}

function buildWarButtons(warId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`war_claim_${warId}`).setLabel('🎖️ Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`war_status_${warId}`).setLabel('📊 War Status').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`war_counter_${warId}`).setLabel('⚔️ Counter').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`war_spies_${warId}`).setLabel('🕵️ Spies').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel('🔗 View War').setStyle(ButtonStyle.Link).setURL(`https://politicsandwar.com/nation/war/timeline/war=${warId}`),
  );
}

async function fetchWarData(warId, ourNationId, enemyNationId) {
  try {
    // NOTE: att_map/def_map do NOT exist in P&W API wars query
    const data = await pwQuery(`
      query W($id:[Int]){wars(id:$id,first:1){data{
        id turnsleft att_resistance def_resistance attid defid
      }}}
    `, { id:[parseInt(warId)] });
    const war = data?.wars?.data?.[0];
    if (!war) return null;
    const weAtt = String(war.attid)===String(ourNationId);
    return {
      ...war,
      isOurAttack:     weAtt,
      ourNationId,
      ourResistance:   weAtt ? war.att_resistance : war.def_resistance,
      ourMAP:          null,
      enemyResistance: weAtt ? war.def_resistance : war.att_resistance,
      enemyMAP:        null,
    };
  } catch (err) { logger.error(`fetchWarData: ${err.message}`); return null; }
}

async function fetchNationData(nationId) {
  try {
    const data = await pwQuery(`
      query N($id:[Int]){nations(id:$id,first:1){data{
        id nation_name score num_cities soldiers tanks aircraft ships missiles nukes spies alliance{name}
      }}}
    `, { id:[parseInt(nationId)] });
    return data?.nations?.data?.[0]||null;
  } catch { return null; }
}

async function fetchNewAttacks(warId, lastAttackId) {
  try {
    const data = await pwQuery(`
      query A($warId:[Int]){warattacks(war_id:$warId,orderBy:{column:ID,order:DESC},first:20){data{
        id war_id attid defid
        type victor success
        att_mun_used def_mun_used att_gas_used def_gas_used
        infra_destroyed infra_destroyed_value
        att_soldiers_lost def_soldiers_lost att_tanks_lost def_tanks_lost
        att_aircraft_lost def_aircraft_lost att_ships_lost def_ships_lost
        date
      }}}
    `, { warId:[parseInt(warId)] });
    const attacks = data?.warattacks?.data||[];
    if (!lastAttackId) return attacks;
    return attacks.filter(a => parseInt(a.id) > parseInt(lastAttackId));
  } catch (err) { logger.error(`fetchNewAttacks: ${err.message}`); return []; }
}

function resolveAttackName(nationId, ctx) {
  if (String(nationId)===String(ctx?.ourNationId))   return ctx.ourNationName||'Our Member';
  if (String(nationId)===String(ctx?.enemyNationId))  return ctx.enemyNationName||'Enemy';
  return `Nation #${nationId}`;
}

// NOTE: WarAttack does NOT expose att_nation_name/def_nation_name in the P&W API
// (confirmed via live GraphQL validation error). Names are resolved from the
// war room's own known nations (ctx) instead of the attack payload.
function buildAttackEmbed(attack, ctx={}) {
  const typeEmojis = { GROUND:'⚔️', AIRSTRIKE_INFRA:'✈️', AIRSTRIKE_SOLDIERS:'✈️', AIRSTRIKE_TANKS:'✈️', AIRSTRIKE_MONEY:'✈️', AIRSTRIKE_SHIP:'✈️', AIRSTRIKE_AIR:'✈️', NAVAL:'🚢', NAVAL_INFRA:'🚢', MISSILE:'🚀', NUKE:'☢️', FORTIFY:'🏰', PEACE:'🕊️' };
  const successLabels = { IMMENSE_TRIUMPH:'🏆 IMMENSE TRIUMPH', MODERATE_SUCCESS:'✅ MODERATE SUCCESS', PYRRHIC_VICTORY:'⚠️ PYRRHIC VICTORY', UTTER_FAILURE:'❌ UTTER FAILURE', VICTORY:'✅ VICTORY' };
  const attackType = attack.type||'UNKNOWN';
  const emoji      = typeEmojis[attackType]||'⚔️';
  const success    = successLabels[attack.success]||attack.success||'?';
  const isAttWin   = String(attack.victor)===String(attack.attid);
  const color      = isAttWin ? 0x2ecc71 : 0xe74c3c;
  const typeLabel  = attackType.replace(/_/g,' ');

  const attName = resolveAttackName(attack.attid, ctx);
  const defName = resolveAttackName(attack.defid, ctx);

  const resultLine = attack.success==='UTTER_FAILURE' ? 'The attack was an **UTTER FAILURE**.'
    : attack.success==='PYRRHIC_VICTORY' ? 'It was a **PYRRHIC VICTORY** — won at great cost.'
    : attack.success==='MODERATE_SUCCESS' ? 'It was a **MODERATE SUCCESS**.'
    : 'It was an **IMMENSE TRIUMPH!**';

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${typeLabel} Attack`)
    .setColor(color)
    .setDescription(
      `**[${attName}](https://politicsandwar.com/nation/id=${attack.attid})** launched a **${typeLabel}** attack against ` +
      `**[${defName}](https://politicsandwar.com/nation/id=${attack.defid})**.\n\n${resultLine}`
    )
    .setTimestamp(new Date(attack.date));

  const gif = getGif(attackType, attack.success);
  if (gif) embed.setImage(gif);

  const attLosses=[], defLosses=[];
  if ((attack.att_soldiers_lost||0)>0) attLosses.push(`👮 ${Number(attack.att_soldiers_lost).toLocaleString()}`);
  if ((attack.att_tanks_lost||0)>0)    attLosses.push(`🚗 ${Number(attack.att_tanks_lost).toLocaleString()}`);
  if ((attack.att_aircraft_lost||0)>0) attLosses.push(`✈️ ${Number(attack.att_aircraft_lost).toLocaleString()}`);
  if ((attack.att_ships_lost||0)>0)    attLosses.push(`🚢 ${Number(attack.att_ships_lost).toLocaleString()}`);
  if ((attack.def_soldiers_lost||0)>0) defLosses.push(`👮 ${Number(attack.def_soldiers_lost).toLocaleString()}`);
  if ((attack.def_tanks_lost||0)>0)    defLosses.push(`🚗 ${Number(attack.def_tanks_lost).toLocaleString()}`);
  if ((attack.def_aircraft_lost||0)>0) defLosses.push(`✈️ ${Number(attack.def_aircraft_lost).toLocaleString()}`);
  if ((attack.def_ships_lost||0)>0)    defLosses.push(`🚢 ${Number(attack.def_ships_lost).toLocaleString()}`);

  if ((attack.infra_destroyed||0)>0) embed.addFields({ name:'🏗️ Infrastructure Destroyed', value:`${Number(attack.infra_destroyed).toFixed(2)} infra — $${Number(attack.infra_destroyed_value||0).toLocaleString()}`, inline:false });
  if (attLosses.length>0) embed.addFields({ name:`⚔️ Attacker Losses (${attName})`, value:attLosses.join(' | '), inline:true });
  if (defLosses.length>0) embed.addFields({ name:`🛡️ Defender Losses (${defName})`, value:defLosses.join(' | '), inline:true });

  const munUsed=(attack.att_mun_used||0)+(attack.def_mun_used||0);
  const gasUsed=(attack.att_gas_used||0)+(attack.def_gas_used||0);
  if (munUsed>0||gasUsed>0) embed.addFields({ name:'⛽ Resources Used', value:`Munitions: ${munUsed.toFixed(1)} | Gasoline: ${gasUsed.toFixed(1)}`, inline:false });

  embed.setFooter({ text:`Attack ID: ${attack.id} | War ID: ${attack.war_id}` });
  return embed;
}

async function checkWarRoomAttacks(client) {
  const rooms = query(`SELECT wr.* FROM war_rooms wr WHERE wr.status='active'`, []).rows;
  for (const room of rooms) await processRoomAttacks(client, room);
}

async function processRoomAttacks(client, room) {
  try {
    const channel = client.channels.cache.get(room.channel_id);
    if (!channel) return;
    const members = query('SELECT DISTINCT war_id, nation_id, nation_name FROM war_room_members WHERE war_room_id=?', [room.id]).rows;
    for (const { war_id, nation_id, nation_name } of members) {
      if (!war_id) continue;
      const ctx = {
        ourNationId:     nation_id,
        ourNationName:   nation_name,
        enemyNationId:   room.enemy_nation_id,
        enemyNationName: room.enemy_nation_name,
      };
      const lastRow = queryOne(`SELECT setting_value FROM alert_settings WHERE guild_id=? AND alert_type='war_attack_last' AND setting_key=?`, [room.guild_id, String(war_id)]);
      const newAttacks = await fetchNewAttacks(war_id, lastRow?.setting_value||null);
      if (newAttacks.length===0) continue;
      newAttacks.sort((a,b)=>parseInt(a.id)-parseInt(b.id));
      for (const attack of newAttacks) {
        if (['FORTIFY'].includes(attack.type)) continue;
        await channel.send({ embeds:[buildAttackEmbed(attack, ctx)] }).catch(()=>{});
        run(`INSERT INTO alert_settings (guild_id,alert_type,setting_key,setting_value) VALUES(?,'war_attack_last',?,?) ON CONFLICT(guild_id,alert_type,setting_key) DO UPDATE SET setting_value=excluded.setting_value`,
          [room.guild_id, String(war_id), String(attack.id)]);
      }
    }
  } catch (err) { logger.error(`processRoomAttacks: ${err.message}`); }
}

async function sendOrRefreshWarCard(channel, room, warData, ourData, enemyData, director, isCounter, counterDetail) {
  try {
    if (room.card_message_id) {
      const oldMsg = await channel.messages.fetch(room.card_message_id).catch(()=>null);
      if (oldMsg) await oldMsg.delete().catch(()=>{});
    }
    const embed   = buildWarCard(warData||{id:room.enemy_nation_id,isOurAttack:true,turnsleft:'?'}, ourData||{nation_name:'Our Member'}, enemyData||{id:room.enemy_nation_id,nation_name:room.enemy_nation_name,alliance:{name:room.enemy_alliance_name}}, director, isCounter||false, counterDetail||null);
    const buttons = buildWarButtons(warData?.id||room.enemy_nation_id);
    const newMsg  = await channel.send({ embeds:[embed], components:[buttons] });
    await newMsg.pin().catch(()=>{});
    run('UPDATE war_rooms SET card_message_id=? WHERE id=?', [newMsg.id, room.id]);
    return newMsg;
  } catch (err) { logger.error(`sendOrRefreshWarCard: ${err.message}`); return null; }
}

async function getOrCreateWarRoom(client, guild, guildId, enemyNation, ourDiscordId, ourMemberName, war, isCounter, counterDetail) {
  try {
    const existing = queryOne('SELECT * FROM war_rooms WHERE guild_id=? AND enemy_nation_id=? AND status=?', [guildId, enemyNation.id, 'active']);
    if (existing) { await addMemberToWarRoom(client, guild, guildId, existing, ourDiscordId, ourMemberName, war); return existing; }
    return await createWarRoom(client, guild, guildId, enemyNation, ourDiscordId, ourMemberName, war, isCounter, counterDetail);
  } catch (err) { logger.error(`War room error: ${err.message}`); }
}

async function createWarRoom(client, guild, guildId, enemyNation, ourDiscordId, ourMemberName, war, isCounter, counterDetail) {
  const catRow = queryOne(`SELECT setting_value FROM alert_settings WHERE guild_id=? AND alert_type='warroom' AND setting_key='category_id'`, [guildId]);
  if (!catRow) return null;
  const category = guild.channels.cache.get(catRow.setting_value);
  if (!category) return null;

  const childCount = guild.channels.cache.filter(c => c.parentId === category.id).size;
  if (childCount >= 50) {
    logger.warn(`War room category "${category.name}" is full (50 channels) — skipping room for ${enemyNation.nation_name}. Archive/close old war rooms or use a second category.`);
    return null;
  }

  const milRole = queryOne(`SELECT discord_role_id FROM guild_roles WHERE guild_id=? AND role_type='military'`, [guildId]);
  const govRole = queryOne(`SELECT discord_role_id FROM guild_roles WHERE guild_id=? AND role_type='government'`, [guildId]);
  const overwrites = [{ id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel] }];
  if (milRole) overwrites.push({ id:milRole.discord_role_id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages] });
  if (govRole) overwrites.push({ id:govRole.discord_role_id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages] });

  const safeName = (enemyNation.nation_name||'unknown').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,80);
  const channel  = await guild.channels.create({ name:`⚔️-${safeName}`, type:ChannelType.GuildText, parent:category.id, topic:`War vs ${enemyNation.nation_name} | ${enemyNation.alliance?.name||'None'}`, permissionOverwrites:overwrites });

  run(`INSERT INTO war_rooms (guild_id,channel_id,enemy_nation_id,enemy_nation_name,enemy_alliance_name,status) VALUES(?,?,?,?,?,'active')`,
    [guildId, channel.id, enemyNation.id, enemyNation.nation_name, enemyNation.alliance?.name||'None']);

  const roomRow = queryOne('SELECT id FROM war_rooms WHERE guild_id=? AND channel_id=?', [guildId, channel.id]);
  const roomId  = roomRow?.id;

  run(`INSERT OR IGNORE INTO war_room_members (war_room_id,discord_user_id,nation_id,nation_name,war_id) VALUES(?,?,?,?,?)`,
    [roomId, ourDiscordId, war.ourNationId, ourMemberName, war.id]);

  if (ourDiscordId) await channel.permissionOverwrites.create(ourDiscordId, {ViewChannel:true,SendMessages:true}).catch(()=>{});

  const link = ourDiscordId ? `<@${ourDiscordId}>` : `**${ourMemberName}**`;
  await channel.send({ content:`${link} joined the fray! ⚔️`+(isCounter?`\n🔄 **COUNTER WAR** — _${counterDetail}_`:'') });

  const [warData, ourData] = await Promise.all([fetchWarData(war.id, war.ourNationId, enemyNation.id), fetchNationData(war.ourNationId)]);
  const roomFull = queryOne('SELECT * FROM war_rooms WHERE id=?', [roomId]);
  await sendOrRefreshWarCard(channel, roomFull, warData||{...war,isOurAttack:!isCounter}, ourData||{nation_name:ourMemberName}, enemyNation, null, isCounter, counterDetail);

  logger.info(`War room created: ${channel.name} for war ${war.id}`);
  return { id:roomId, channel_id:channel.id };
}

async function addMemberToWarRoom(client, guild, guildId, roomRow, ourDiscordId, ourMemberName, war) {
  const channel = guild.channels.cache.get(roomRow.channel_id);
  if (!channel) return;
  const already = queryOne('SELECT id FROM war_room_members WHERE war_room_id=? AND discord_user_id=?', [roomRow.id, ourDiscordId]);
  if (already) return;
  run(`INSERT OR IGNORE INTO war_room_members (war_room_id,discord_user_id,nation_id,nation_name,war_id) VALUES(?,?,?,?,?)`, [roomRow.id,ourDiscordId,war.ourNationId,ourMemberName,war.id]);
  if (ourDiscordId) await channel.permissionOverwrites.create(ourDiscordId, {ViewChannel:true,SendMessages:true}).catch(()=>{});
  await channel.send({ content:`${ourDiscordId?`<@${ourDiscordId}>`:`**${ourMemberName}**`} also joined the fray! ⚔️` });
}

async function removeMemberFromWarRoom(client, guild, guildId, nationId, warId) {
  try {
    const member = queryOne(`SELECT wrm.*,wr.channel_id,wr.id as room_id FROM war_room_members wrm JOIN war_rooms wr ON wr.id=wrm.war_room_id WHERE wr.guild_id=? AND wrm.nation_id=? AND wrm.war_id=?`, [guildId,nationId,warId]);
    if (!member) return;
    run('DELETE FROM war_room_members WHERE id=?', [member.id]);
    const channel = guild.channels.cache.get(member.channel_id);
    if (channel) {
      if (member.discord_user_id) await channel.permissionOverwrites.delete(member.discord_user_id).catch(()=>{});
      await channel.send({ content:`✅ <@${member.discord_user_id}>'s war ended — removed from this room.` });
    }
    const remaining = query('SELECT * FROM war_room_members WHERE war_room_id=?', [member.room_id]).rows;
    if (remaining.length===0) {
      if (channel) { await channel.send({content:'🏁 All wars concluded — deleting in 10 seconds.'}); setTimeout(async()=>{ await channel.delete().catch(()=>{}); },10000); }
      run('UPDATE war_rooms SET status=? WHERE id=?', ['closed',member.room_id]);
    }
  } catch (err) { logger.error(`removeMemberFromWarRoom: ${err.message}`); }
}

module.exports = { getOrCreateWarRoom, removeMemberFromWarRoom, buildWarCard, buildWarButtons, fetchWarData, fetchNationData, sendOrRefreshWarCard, checkWarRoomAttacks };
