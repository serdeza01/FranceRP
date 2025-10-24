const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lier-modérateur")
    .setDescription(
      "Lie un utilisateur Discord à son pseudo Roblox pour le système de sanctions."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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

      const isNew = result.affectedRows === 1;

      let message;
      if (result.affectedRows === 1) {
        message = `✅ Liaison créée :\nDiscord: **${user.tag}** (<@${discordId}>) est maintenant lié au pseudo Roblox: **${robloxPseudo}**.`;
      } else if (result.affectedRows === 2) {
        message = `🔄 Liaison mise à jour :\nLe pseudo Roblox **${robloxPseudo}** est maintenant lié à l'utilisateur Discord: **${user.tag}** (<@${discordId}>).`;
      } else {
        message = `✅ Liaison confirmée :\n**${robloxPseudo}** est déjà lié à <@${discordId}>. Aucune modification nécessaire.`;
      }

      return interaction.editReply({
        content: message,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de la liaison modérateur/roblox :", error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue lors de la tentative de liaison. Vérifiez la console et assurez-vous que la table \`roblox_to_discord\` existe.`,
        ephemeral: true,
      });
    }
  },
};
