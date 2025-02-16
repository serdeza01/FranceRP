const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("supprimer-assurance")
    .setDescription("Supprime la carte d'assurance d'un utilisateur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("L'utilisateur dont on supprime la carte d'assurance")
        .setRequired(true)
    ),

  async execute(interaction) {
    // Vérification du rôle requis pour supprimer une assurance
    // (ID de rôle déjà utilisé dans la commande d'ajout d'assurance)
    if (!interaction.member.roles.cache.has("1328419821901189170")) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de supprimer l'assurance.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");

    try {
      const [result] = await db.promise().execute(
        "DELETE FROM assurance WHERE discord_id = ?",
        [user.id]
      );

      if (result.affectedRows === 0) {
        return interaction.reply({
          content: `Aucune carte d'assurance n'a été trouvée pour ${user.username}.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `La carte d'assurance de ${user.username} a été supprimée avec succès.`,
        ephemeral: false,
      });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.reply({
        content: "Erreur lors de la suppression de l'assurance.",
        ephemeral: true,
      });
    }
  },
};
