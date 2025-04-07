const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-dm")
    .setDescription("Configurer l'envoi des DM de rappel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("option")
        .setDescription("Quelle option de DM souhaitez-vous configurer ?")
        .setRequired(true)
        .addChoices({ name: "Présence staff", value: "staff_presence" })
    )
    .addBooleanOption((option) =>
      option
        .setName("active")
        .setDescription("Activer ou désactiver cette fonctionnalité ?")
        .setRequired(true)
    ),
  async execute(interaction) {
    const optionType = interaction.options.getString("option");
    const active = interaction.options.getBoolean("active");
    const guildId = interaction.guild.id;

    try {
      await db.execute(
        `INSERT INTO dm_config (guild_id, type, active) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE active = VALUES(active)`,
        [guildId, optionType, active]
      );

      return interaction.reply({
        content: `Les DM pour ${optionType} ont été ${active ? "activés" : "désactivés"} avec succès.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de la configuration DM :", error);
      return interaction.reply({
        content: "Une erreur est survenue lors de la configuration des DM.",
        ephemeral: true,
      });
    }
  },
};
