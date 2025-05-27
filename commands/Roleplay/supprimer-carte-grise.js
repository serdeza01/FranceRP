const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("supprimer-carte-grise")
    .setDescription("Supprime la carte grise d'un utilisateur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("L'utilisateur dont on supprime la carte grise")
        .setRequired(true)
    ),
  async execute(interaction) {
    const [assuranceRoles] = await db.execute(
      "SELECT role_id FROM role_permissions WHERE guild_id = ? AND permission_type = 'carte-grise'",
      [interaction.guild.id]
    );
    const member = interaction.member;
    const hasPermission = assuranceRoles.some((role) => member.roles.cache.has(role.role_id));
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de supprimer la carte grise.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");

    try {
      const [result] = await db.execute(
        "DELETE FROM carte-grise WHERE guild_id = ? AND discord_id = ?",
        [interaction.guild.id, user.id]
      );

      if (result.affectedRows === 0) {
        return interaction.reply({
          content: `Aucune carte grise n'a été trouvée pour ${user.username}.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `La carte grise de ${user.username} a été supprimée avec succès.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.reply({
        content: "Erreur lors de la suppression de la carte grise.",
        ephemeral: true,
      });
    }
  },
};
