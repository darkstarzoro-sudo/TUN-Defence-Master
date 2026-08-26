const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query, run, queryOne } = require('../../utils/database');
const { pwQuery } = require('../../utils/pwApi');
const logger = require('../../utils/logger');

function buildWarCard(war, ourMember, enemyNation, assignedTo=null, isCounter=false, counterDetail=null) {
  const color  = war.isOurAttack ? 0x3498db : 0xe74c3c;
  const typeTag = isCounter ? '🔄 **COUNTER WAR**' : war.isOurAttack ? '⚔️ **OFFENSIVE WAR**' : '🛡️ **DEFENSIVE WAR**';
  return new EmbedBuilder().setTitle(`${typeTag} — vs ${enemyNation?.nation_name||'Unknown'}`).setColor(color)
    .setDescription((isCounter&&counterDetail?`✅ _${counterDetail}_\n\n`:'')+`[View War](https://politicsandwar.com/nation/war/timeline/war=${war.id})`)
    .addFields(
      { name:`🛡️ Our Member — ${ourMember?.nation_name||'Unknown'}`, value:[`⭐ NS: **${Math.round(ourMember?.score||0).toLocaleString()}** | 🏙️ Cities: **${ourMember?.num_cities||'?'}**`,`👮 ${(ourMember?.soldiers||0).toLocaleString()} | 🚗 ${(ourMember?.tanks||0).toLocaleString()} | ✈️ ${ourMember?.aircraft||0} | 🚢 ${ourMember?.ships||0}`,`🚀 ${ourMember?.missiles||0} | ☢️ ${ourMember?.nukes||0} | 🕵️ ${ourMember?.spies||0}`,`❤️ Resistance: **${war.ourResistance??'?'}/100** | MAP: **${war.ourMAP??'?'}/12**`].join('\n'), inline:false },
      { name:`⚔️ Enemy — [${enemyNation?.nation_name||'Unknown'}](https://politicsandwar.com/nation/id=${enemyNation?.id}) (${enemyNation?.alliance?.name||'None'})`, value:[`⭐ NS: **${Math.round(enemyNation?.score||0).toLocaleString()}** | 🏙️ Cities: **${enemyNation?.num_cities||'?'}**`,`👮 ${(enemyNation?.soldiers||0).toLocaleString()} | 🚗 ${(enemyNation?.tanks||0).toLocaleString()} | ✈️ ${enemyNation?.aircraft||0} | 🚢 ${enemyNation?.ships||0}`,`🚀 ${enemyNation?.missiles||0} | ☢️ ${enemyNation?.nukes||0} | 🕵️ ${enemyNation?.spies||0}`,`❤️ Resistance: **${war.enemyResistance??'?'}/100** | MAP: **${war.enemyMAP??'?'}/12**`].join('\n'), inline:false },
      { name:'⏳ War Status', value:`Turns Left: **${war.turnsleft??'?'}** | War ID: \`${war.id}\``, inline:false },
    ).setTimestamp().setFooter({ text: assignedTo?`Director: @${assignedTo}`:'No director — click Claim to take command' });
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
    const data = await pwQuery(`query W($id:[Int]){wars(id:$id,first:1){data{id turnsleft att_resistance def_resistance att_map def_map attid defid}}}`, { id:[parseInt(warId)] });
    const war = data?.wars?.data?.[0];
    if (!war) return null;
    const weAtt = String(war.attid)===String(ourNationId);
    return { ...war, isOurAttack:weAtt, ourNationId, ourResistance:weAtt?war.att_resistance:war.def_resistance, ourMAP:weAtt?war.att_map:war.def_map, enemyResistance:weAtt?war.def_resistance:war.att_resistance, enemyMAP:weAtt?war.def_map:war.att_map };
  } catch (err) { logger.error(`fetchWarData: ${err.message}`); return null; }
}

async function fetchNationData(nationId) {
  try {
    const data = await pwQuery(`query N($id:[Int]){nations(id:$id,first:1){data{id nation_name score num_cities soldiers tanks aircraft ships missiles nukes spies alliance{name}}}}`, { id:[parseInt(nationId)] });
    return data?.nations?.data?.[0]||null;
  } catch { return null; }
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
  if (!catRow) { logger.warn(`No war room category for guild ${guildId} — run /warroom setup`); return null; }
  const category = guild.channels.cache.get(catRow.setting_value);
  if (!category) { logger.warn(`War room category not found`); return null; }

  const milRole = queryOne(`SELECT discord_role_id FROM guild_roles WHERE guild_id=? AND role_type='military'`, [guildId]);
  const govRole = queryOne(`SELECT discord_role_id FROM guild_roles WHERE guild_id=? AND role_type='government'`, [guildId]);
  const overwrites = [{ id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel] }];
  if (milRole) overwrites.push({ id:milRole.discord_role_id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages] });
  if (govRole) overwrites.push({ id:govRole.discord_role_id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages] });

  const safeName = (enemyNation.nation_name||'unknown').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,80);
  const channel  = await guild.channels.create({ name:`⚔️-${safeName}`, type:ChannelType.GuildText, parent:category.id, topic:`War vs ${enemyNation.nation_name} | ${enemyNation.alliance?.name||'None'}`, permissionOverwrites:overwrites });

  run(`INSERT INTO war_rooms (guild_id,channel_id,enemy_nation_id,enemy_nation_name,enemy_alliance_name,status) VALUES(?,?,?,?,?,'active')`,
    [guildId,channel.id,enemyNation.id,enemyNation.nation_name,enemyNation.alliance?.name||'None']);

  const roomRow = queryOne('SELECT id FROM war_rooms WHERE guild_id=? AND channel_id=?', [guildId,channel.id]);
  const roomId  = roomRow?.id;

  run(`INSERT OR IGNORE INTO war_room_members (war_room_id,discord_user_id,nation_id,nation_name,war_id) VALUES(?,?,?,?,?)`,
    [roomId,ourDiscordId,war.ourNationId,ourMemberName,war.id]);

  if (ourDiscordId) await channel.permissionOverwrites.create(ourDiscordId,{ViewChannel:true,SendMessages:true}).catch(()=>{});

  const link = ourDiscordId?`<@${ourDiscordId}>`:`**${ourMemberName}**`;
  await channel.send({ content:`${link} joined the fray! ⚔️`+(isCounter?`\n🔄 **COUNTER WAR** — _${counterDetail}_`:'') });

  const [warData,ourData] = await Promise.all([fetchWarData(war.id,war.ourNationId,enemyNation.id),fetchNationData(war.ourNationId)]);
  const embed   = buildWarCard(warData||{...war,isOurAttack:!isCounter},ourData||{nation_name:ourMemberName},enemyNation,null,isCounter,counterDetail);
  const cardMsg = await channel.send({ embeds:[embed], components:[buildWarButtons(war.id)] });

  run(`UPDATE war_rooms SET card_message_id=? WHERE id=?`,[cardMsg.id,roomId]);
  logger.info(`War room created: ${channel.name} for war ${war.id}`);
  return { id:roomId, channel_id:channel.id };
}

async function addMemberToWarRoom(client, guild, guildId, roomRow, ourDiscordId, ourMemberName, war) {
  const channel = guild.channels.cache.get(roomRow.channel_id);
  if (!channel) return;
  const already = queryOne('SELECT id FROM war_room_members WHERE war_room_id=? AND discord_user_id=?',[roomRow.id,ourDiscordId]);
  if (already) return;
  run(`INSERT OR IGNORE INTO war_room_members (war_room_id,discord_user_id,nation_id,nation_name,war_id) VALUES(?,?,?,?,?)`,[roomRow.id,ourDiscordId,war.ourNationId,ourMemberName,war.id]);
  if (ourDiscordId) await channel.permissionOverwrites.create(ourDiscordId,{ViewChannel:true,SendMessages:true}).catch(()=>{});
  await channel.send({ content:`${ourDiscordId?`<@${ourDiscordId}>`:`**${ourMemberName}**`} also joined the fray! ⚔️` });
}

async function removeMemberFromWarRoom(client, guild, guildId, nationId, warId) {
  try {
    const member = queryOne(`SELECT wrm.*,wr.channel_id,wr.id as room_id FROM war_room_members wrm JOIN war_rooms wr ON wr.id=wrm.war_room_id WHERE wr.guild_id=? AND wrm.nation_id=? AND wrm.war_id=?`,[guildId,nationId,warId]);
    if (!member) return;
    run('DELETE FROM war_room_members WHERE id=?',[member.id]);
    const channel = guild.channels.cache.get(member.channel_id);
    if (channel) {
      if (member.discord_user_id) await channel.permissionOverwrites.delete(member.discord_user_id).catch(()=>{});
      await channel.send({ content:`✅ <@${member.discord_user_id}>'s war ended — removed from this room.` });
    }
    const remaining = query('SELECT * FROM war_room_members WHERE war_room_id=?',[member.room_id]).rows;
    if (remaining.length===0) {
      if (channel) { await channel.send({content:'🏁 All wars concluded — deleting in 10 seconds.'}); setTimeout(async()=>{ await channel.delete().catch(()=>{}); },10000); }
      run('UPDATE war_rooms SET status=? WHERE id=?',['closed',member.room_id]);
    }
  } catch (err) { logger.error(`removeMemberFromWarRoom: ${err.message}`); }
}

module.exports = { getOrCreateWarRoom, removeMemberFromWarRoom, buildWarCard, buildWarButtons, fetchWarData, fetchNationData };
