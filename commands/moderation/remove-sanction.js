const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-sanction")
    .setDescription("Supprimer une sanction que vous avez appliquée à un utilisateur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName("pseudo")
        .setDescription("Le pseudo de l'utilisateur sanctionné")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;

      const SUPER_MOD_ROLES = [
        "1313029840328327248",
        "1304151263851708458",
      ];
      const isSuperMod = SUPER_MOD_ROLES.some((rid) =>
        interaction.member.roles.cache.has(rid)
      );

      const [[config]] = await db.execute(
        "SELECT allowed_role_id FROM sanction_config WHERE guild_id = ?",
        [guildId]
      );

      let allowedRoleId = null;
      if (config && config.allowed_role_id != null) {
        allowedRoleId = String(config.allowed_role_id);
      }

      if (!isSuperMod && (!allowedRoleId || !interaction.member.roles.cache.has(allowedRoleId))) {
        return interaction.reply({
          content: "❌ Vous n'avez pas la permission d'utiliser cette commande.",
          ephemeral: true,
        });
      }

      const targetPseudo = interaction.options.getString("pseudo");

      const [sanctions] = await db.execute(
        "SELECT id, pseudo, raison, duration FROM sanctions WHERE guild_id = ? AND punisher_id = ? AND pseudo = ?",
        [guildId, interaction.user.id, targetPseudo]
      );

      if (sanctions.length === 0) {
        return interaction.reply({
          content: `❌ Vous n'avez appliqué aucune sanction pour le pseudo **${targetPseudo}**.`,
          ephemeral: true,
        });
      }

      const options = sanctions.map((sanction) => ({
        label: `Sanction ${sanction.id}`,
        description: `Raison: ${sanction.raison} – Durée: ${sanction.duration}`,
        value: sanction.id.toString(),
      }));

      const embed = new EmbedBuilder()
        .setTitle("Suppression d'une sanction")
        .setDescription(
          `Sélectionnez la sanction appliquée sur **${targetPseudo}** que vous souhaitez supprimer.`
        )
        .setColor(0xff0000)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("remove_sanction_select")
          .setPlaceholder("Choisissez une sanction à supprimer")
          .addOptions(options)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });

      const filter = (i) =>
        i.customId === "remove_sanction_select" &&
        i.user.id === interaction.user.id;

      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 60000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        const sanctionId = i.values[0];

        await db.execute(
          "DELETE FROM sanctions WHERE id = ? AND punisher_id = ?",
          [sanctionId, interaction.user.id]
        );

        await i.update({
          content: `✅ La sanction d'ID ${sanctionId} a été supprimée avec succès.`,
          embeds: [],
          components: [],
        });
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          await interaction.editReply({
            content: "⏱️ Aucune sélection effectuée dans le délai imparti.",
            components: [],
          });
        }
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de la sanction :", error);
      return interaction.reply({
        content: "❌ Une erreur est survenue lors de la suppression de la sanction.",
        ephemeral: true,
      });
    }
  },
};
