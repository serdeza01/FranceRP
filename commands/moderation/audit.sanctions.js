const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("audit-sanctions")
    .setDescription(
      "[ADMIN] Affiche les statistiques de manquements de sanctions (non enregistrées)."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((option) =>
      option
        .setName("jours")
        .setDescription(
          "Période d'audit (ex: 7 pour la semaine, 30 pour le mois)."
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const days = interaction.options.getInteger("jours");
    const guildId = interaction.guildId;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      // 1. Compter les manquements totaux (résolus et non résolus)
      const [totalMisses] = await db.execute(
        `SELECT COUNT(*) as total FROM sanction_misses WHERE guild_id = ? AND alert_time >= ?`,
        [guildId, cutoffDate]
      );

      const [unresolvedMisses] = await db.execute(
        `SELECT punisher_roblox_pseudo, COUNT(*) as count FROM sanction_misses WHERE guild_id = ? AND resolved_at IS NULL AND alert_time >= ? GROUP BY punisher_roblox_pseudo ORDER BY count DESC`,
        [guildId, cutoffDate]
      );

      const resolvedCount =
        totalMisses[0].total -
        unresolvedMisses.reduce((acc, row) => acc + row.count, 0);
      const totalCount = totalMisses[0].total;
      const successRate =
        totalCount > 0
          ? ((resolvedCount / totalCount) * 100).toFixed(1)
          : "N/A";

      let topMissers = unresolvedMisses
        .map(
          (row) =>
            `- **${row.punisher_roblox_pseudo}**: ${row.count} manquement(s)`
        )
        .slice(0, 5)
        .join("\n");

      if (topMissers === "") {
        topMissers = "✅ Aucune sanction oubliée sur la période !";
      }

      const embed = new EmbedBuilder()
        .setTitle(`📊 Audit des Sanctions Manquantes (${days} Jours)`)
        .setColor(unresolvedMisses.length > 0 ? "Red" : "Green")
        .addFields(
          {
            name: "Total des Sanctions Oubliées (Audit)",
            value: totalCount.toString(),
            inline: true,
          },
          {
            name: "Non Résolu (Après 2h)",
            value: unresolvedMisses
              .reduce((acc, row) => acc + row.count, 0)
              .toString(),
            inline: true,
          },
          {
            name: "Taux de Résolution",
            value: `${successRate}%`,
            inline: true,
          },
          {
            name: `Top 5 des Modérateurs Ayant Oublié (Non Résolu)`,
            value: topMissers,
            inline: false,
          }
        )
        .setFooter({
          text: `Période d'audit commençant le ${cutoffDate.toLocaleDateString()}`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erreur dans /audit-sanctions :", error);
      await interaction.editReply({
        content: "❌ Une erreur est survenue lors de l'exécution de l'audit.",
        ephemeral: true,
      });
    }
  },
};
