const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { run, queryOne } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder().setName('warroom').setDescription('Configure war room settings')
    .addSubcommand(sub => sub.setName('setup').setDescription('Set the category where war rooms will be created').addChannelOption(opt=>opt.setName('category').setDescription('Discord category for war rooms').setRequired(true)))
    .addSubcommand(sub => sub.setName('status').setDescription('Show current war room configuration')),
  requiredRole: 'admin',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub==='setup') {
      const cat = interaction.options.getChannel('category');
      if (cat.type!==ChannelType.GuildCategory) return interaction.reply({content:'❌ Please select a **Category**, not a text channel.',flags:64});
      run(`INSERT INTO alert_settings(guild_id,alert_type,setting_key,setting_value)VALUES(?,'warroom','category_id',?)ON CONFLICT(guild_id,alert_type,setting_key)DO UPDATE SET setting_value=excluded.setting_value`,[interaction.guildId,cat.id]);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('✅ War Room Category Set').setColor(0x2ecc71).setDescription(`War rooms will be created in **${cat.name}**.\n\n**Bot needs on this category:**\n• Manage Channels\n• Manage Permissions\n• View Channel\n• Send Messages`).setTimestamp()],flags:64});
    }
    if (sub==='status') {
      const row = queryOne(`SELECT setting_value FROM alert_settings WHERE guild_id=? AND alert_type='warroom' AND setting_key='category_id'`,[interaction.guildId]);
      if (!row) return interaction.reply({content:'❌ No category set. Use `/warroom setup`.',flags:64});
      const cat = interaction.guild.channels.cache.get(row.setting_value);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('⚙️ War Room Config').setColor(0x3498db).addFields({name:'📁 Category',value:cat?`**${cat.name}**`:'❌ Not found — reconfigure'}).setTimestamp()],flags:64});
    }
  },
};
