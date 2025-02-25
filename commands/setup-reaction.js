const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-reactions')
    .setDescription('Active/désactive les réactions ✅/❌ dans le salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    const channelId = interaction.channel.id;
    const guildId = interaction.guild.id;

    try {
      const existing = db.prepare('SELECT * FROM reaction_channels WHERE channel_id = ?').get(channelId);
      
      if (existing) {
        db.prepare('DELETE FROM reaction_channels WHERE channel_id = ?').run(channelId);
        global.reactionChannels.delete(channelId);
        await interaction.reply({ content: '❌ Réactions désactivées!', ephemeral: true });
      } else {
        db.prepare('INSERT INTO reaction_channels (channel_id, guild_id) VALUES (?, ?)').run(channelId, guildId);
        global.reactionChannels.add(channelId);
        await interaction.reply({ content: '✅ Réactions activées!', ephemeral: true });
      }
    } catch (error) {
      console.error('Erreur DB:', error);
      await interaction.reply({ content: '⚠️ Erreur lors de la configuration!', ephemeral: true });
    }
  }
};
