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
    const [permisRoles] = await db.execute(
      "SELECT role_id FROM role_permissions WHERE guild_id = ? AND permission_type = 'permis'",
      [interaction.guild.id]
    );
    const member = interaction.member;
    const hasPermission = permisRoles.some((role) => member.roles.cache.has(role.role_id));
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de supprimer le permis.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");

    try {
      const [result] = await db.execute(
        "DELETE FROM permis WHERE guild_id = ? AND discord_id = ?",
        [interaction.guild.id, user.id]
      );

      if (result.affectedRows === 0) {
        return interaction.reply({
          content: `Aucun permis n'a été trouvé pour ${user.username}.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `Le permis de ${user.username} a été supprimé avec succès.`,
        ephemeral: true,
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
