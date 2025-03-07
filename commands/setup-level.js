const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-level")
    .setDescription("Configure le système de niveaux")
    .addBooleanOption(option =>
      option.setName("activer")
        .setDescription("Activer ou désactiver le système de niveaux")
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName("salon")
        .setDescription("Salon pour l'annonce des niveaux (optionnel)")
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName("annonce")
        .setDescription("Activer ou désactiver l'annonce lors d'un passage de niveau")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id;
    const activer = interaction.options.getBoolean("activer");
    const salon = interaction.options.getChannel("salon");
    const annonce = interaction.options.getBoolean("annonce");

    try {
      await db.execute(
        `INSERT INTO level_config (guild_id, system_enabled, announce_enabled, announce_channel)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           system_enabled = VALUES(system_enabled),
           announce_enabled = VALUES(announce_enabled),
           announce_channel = VALUES(announce_channel)`,
        [guildId, activer, annonce ?? true, salon ? salon.id : null]
      );

      return interaction.editReply({ content: "Configuration du système de niveaux mise à jour !" });
    } catch (err) {
      console.error("Erreur lors de la configuration du système de niveaux :", err);
      return interaction.editReply({ content: "Une erreur est survenue lors de la configuration." });
    }
  },
};
