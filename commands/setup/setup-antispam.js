const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-antispam")
    .setDescription("Active ou désactive le système anti-spam")
    .addBooleanOption((option) =>
      option
        .setName("activer")
        .setDescription("Activer (true) ou désactiver (false) le système anti-spam")
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "Vous devez être administrateur pour utiliser cette commande.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const activer = interaction.options.getBoolean("activer");

    try {
      await db.execute(
        `INSERT INTO antispam_config (guild_id, enabled)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
        [guildId, activer]
      );
      return interaction.reply({
        content: `Le système anti-spam est désormais **${activer ? "activé" : "désactivé"}** sur ce serveur.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("Erreur lors de la configuration de l'anti-spam :", err);
      return interaction.reply({
        content: "Une erreur est survenue lors de la configuration de l'anti-spam.",
        ephemeral: true,
      });
    }
  },
};
