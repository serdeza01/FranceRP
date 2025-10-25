const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update-sanction-log-channel")
    .setDescription(
      "[ADMIN] Met à jour le salon de log de surveillance externe."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("salon")
        .setDescription(
          "Le salon où l'application externe poste les logs (Kick/Ban)."
        )
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const logChannel = interaction.options.getChannel("salon");

    try {
      const [rows] = await db.execute(
        `SELECT guild_id FROM sanction_config WHERE guild_id = ?`,
        [guildId]
      );

      if (rows.length === 0) {
        return interaction.editReply({
          content:
            "❌ Aucune configuration de sanction trouvée. Utilisez d'abord `/setup-sanction-channels initialiser`.",
          ephemeral: true,
        });
      }
      await db.execute(
        `UPDATE sanction_config SET log_channel_id = ? WHERE guild_id = ?`,
        [logChannel.id, guildId]
      );

      return interaction.editReply({
        content: `✅ Le salon de **log de surveillance** externe a été mis à jour vers <#${logChannel.id}>. Le système d'alerte est maintenant actif.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour du salon de log de surveillance :",
        error
      );
      return interaction.editReply({
        content:
          "❌ Une erreur est survenue lors de la mise à jour du salon. Regardez la console.",
        ephemeral: true,
      });
    }
  },
};
