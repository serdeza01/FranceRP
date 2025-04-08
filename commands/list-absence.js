const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

/**
 * Convertit une date SQL (string ou Date) au format "AAAA-MM-JJ" en "JJ/MM/AAAA"
 * @param {string|Date} sqlDate - La date au format SQL (ou un objet Date)
 * @returns {string} La date formatée en "JJ/MM/AAAA"
 */
function convertToDisplayDate(sqlDate) {
  let dateStr;
  if (typeof sqlDate === "string") {
    dateStr = sqlDate;
  } else if (sqlDate instanceof Date) {
    dateStr = sqlDate.toISOString().split("T")[0];
  } else {
    dateStr = String(sqlDate);
  }
  const parts = dateStr.split("-");
  if (parts.length !== 3) return sqlDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("absence")
    .setDescription("Afficher les absences pour une date donnée")
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("La date à vérifier (JJ/MM/AAAA)")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const [configRows] = await db.execute(
        "SELECT is_enabled, allowed_role_id FROM absence_config WHERE guild_id = ?",
        [interaction.guild.id]
      );
      if (configRows.length === 0 || !configRows[0].is_enabled) {
        return interaction.reply({
          content: "❌ Le système d'absence n'est pas activé sur ce serveur.",
          ephemeral: true,
        });
      }
      const allowedRoleId = configRows[0].allowed_role_id;
      if (!interaction.member.roles.cache.has(allowedRoleId)) {
        return interaction.reply({
          content: "❌ Vous n'êtes pas autorisé à utiliser cette commande.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de la configuration d'absence :", error);
      return interaction.reply({
        content: "❌ Une erreur s'est produite lors de la vérification de la configuration d'absence.",
        ephemeral: true,
      });
    }

    const dateStr = interaction.options.getString("date");
    let sqlDate;
    try {
      const parts = dateStr.split("/");
      if (parts.length !== 3) throw new Error("Format de date invalide");
      const [day, month, year] = parts;
      sqlDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    } catch (error) {
      return interaction.reply({
        content: "❌ Format de date invalide. Veuillez utiliser le format JJ/MM/AAAA.",
        ephemeral: true,
      });
    }

    try {
      const [results] = await db.execute(
        "SELECT user_id, motif, date_debut, date_fin FROM absences WHERE ? BETWEEN date_debut AND date_fin AND guild_id = ?",
        [sqlDate, interaction.guild.id]
      );

      if (results.length === 0) {
        return interaction.reply({
          content: "Aucune absence trouvée pour cette date.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`Absences pour le ${dateStr}`)
        .setColor(0x00aaff)
        .setTimestamp();

      for (const absence of results) {
        const userId = String(absence.user_id);
        let username = "Inconnu";
        try {
          const user = await interaction.client.users.fetch(userId);
          if (user) {
            username = user.username;
          }
        } catch (err) {
          console.error(`Impossible de récupérer l'utilisateur avec l'ID ${userId} :`, err);
        }

        const dateDebutAffichage = convertToDisplayDate(absence.date_debut);
        const dateFinAffichage = convertToDisplayDate(absence.date_fin);
        embed.addFields({
          name: `Utilisateur : ${username}`,
          value: `Motif : ${absence.motif}\nDu : ${dateDebutAffichage}\nAu : ${dateFinAffichage}`,
          inline: false,
        });
      }
      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Erreur lors de la récupération des absences :", error);
      return interaction.reply({
        content: "❌ Une erreur s'est produite lors de la récupération des absences.",
        ephemeral: true,
      });
    }
  },
};
