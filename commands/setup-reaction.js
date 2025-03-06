const { 
  SlashCommandBuilder, 
  PermissionFlagsBits 
} = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-reactions")
    .setDescription("Active/désactive les réactions ✅/❌ dans le salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channelId = interaction.channel.id;
    const guildId = interaction.guild.id;

    try {
      const [rows] = await db.execute(
        "SELECT * FROM reaction_channels WHERE channel_id = ?",
        [channelId]
      );

      if (rows.length > 0) {
        await db.execute(
          "DELETE FROM reaction_channels WHERE channel_id = ?",
          [channelId]
        );
        global.reactionChannels.delete(channelId);
        await interaction.reply({
          content: "❌ Réactions désactivées!",
          flags: 64
        });
      } else {
        await db.execute(
          "INSERT INTO reaction_channels (channel_id, guild_id) VALUES (?, ?)",
          [channelId, guildId]
        );
        global.reactionChannels.add(channelId);
        await interaction.reply({
          content: "✅ Réactions activées!",
          flags: 64
        });
      }
    } catch (error) {
      console.error("Erreur DB:", error);
      await interaction.reply({
        content: "⚠️ Erreur lors de la configuration!",
        flags: 64
      });
    }
  },
};
