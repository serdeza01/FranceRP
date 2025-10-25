const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lier-modérateur")
    .setDescription(
      "Lie un utilisateur Discord à son pseudo Roblox pour le système de sanctions."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("L'utilisateur Discord du modérateur à lier.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("pseudo_roblox")
        .setDescription(
          "Le pseudo Roblox exact (Author dans le log) de ce modérateur."
        )
        .setRequired(true)
    ),

  async execute(interaction) {

    const user = interaction.options.getUser("utilisateur");
    const robloxPseudo = interaction.options.getString("pseudo_roblox").trim();
    const discordId = user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const [result] = await db.execute(
        `INSERT INTO roblox_to_discord (roblox_pseudo, discord_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE discord_id = VALUES(discord_id)`,
        [robloxPseudo, discordId]
      );

      let message;
      if (result.affectedRows === 1) {
        message = `✅ Liaison créée :\nDiscord: **${user.tag}** (<@${discordId}>) est lié au pseudo Roblox: **${robloxPseudo}**.`;
      } else if (result.affectedRows === 2) {
        message = `🔄 Liaison mise à jour :\nLe pseudo Roblox **${robloxPseudo}** est maintenant lié à l'utilisateur Discord: **${user.tag}** (<@${discordId}>).`;
      } else {
        message = `✅ Liaison confirmée :\n**${robloxPseudo}** est déjà lié à <@${discordId}>.`;
      }

      return interaction.editReply({
        content: message,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de la liaison modérateur/roblox :", error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue lors de la tentative de liaison.`,
        ephemeral: true,
      });
    }
  },
};
