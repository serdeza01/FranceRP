const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("supprimer-permis")
    .setDescription("Supprime le permis d'un utilisateur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("L'utilisateur dont on supprime le permis")
        .setRequired(true)
    ),

  async execute(interaction) {
    // Vérification du rôle requis pour supprimer un permis
    // (ID de rôle déjà utilisé dans la commande d'ajout de permis)
    if (!interaction.member.roles.cache.has("1326923044500934656")) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de supprimer le permis.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");

    try {
      const [result] = await db.promise().execute(
        "DELETE FROM permis WHERE discord_id = ?",
        [user.id]
      );

      if (result.affectedRows === 0) {
        return interaction.reply({
          content: `Aucun permis n'a été trouvé pour ${user.username}.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `Le permis de ${user.username} a été supprimé avec succès.`,
        ephemeral: false,
      });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.reply({
        content: "Erreur lors de la suppression du permis.",
        ephemeral: true,
      });
    }
  },
};
