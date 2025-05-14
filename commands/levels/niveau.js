const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("niveau")
    .setDescription("Affiche ton niveau ou celui d'un autre utilisateur")
    .addUserOption(option =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur dont vous voulez voir le niveau")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const user = interaction.options.getUser("utilisateur") || interaction.user;

    try {
      const [results] = await db.execute(
        "SELECT xp, level FROM user_levels WHERE guild_id = ? AND discord_id = ?",
        [guildId, user.id]
      );

      if (results.length === 0) {
        return interaction.editReply({
          content: `<@${user.id}> n'a pas encore de niveau enregistré sur ce serveur.`,
          ephemeral: true
        });
      }

      let { xp, level } = results[0];

      const [rankResult] = await db.execute(
        "SELECT COUNT(*) AS rank FROM user_levels WHERE guild_id = ? AND (level > ? OR (level = ? AND xp > ?))",
        [guildId, level, level, xp]
      );
      const rank = rankResult[0].rank + 1;

      const xpForNextLevel = Math.floor(13.3 * Math.pow(level, 2));
      const currentXp = xp;
      const nextXp = xpForNextLevel;

      const progress = Math.min(currentXp / nextXp, 1);

      const BAR_LENGTH = 12;
      const FILLED = "🟩";
      const EMPTY = "⬜";
      const filledCount = Math.round(progress * BAR_LENGTH);
      const emptyCount = BAR_LENGTH - filledCount;
      const bar = FILLED.repeat(filledCount) + EMPTY.repeat(emptyCount);

      const percent = (progress * 100).toFixed(1);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Niveau de ${user.username}`)
        .setColor("#00FFFF")
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
          { name: "Niveau", value: `\`${level}\``, inline: true },
          { name: "XP", value: `\`${currentXp} / ${nextXp}\``, inline: true },
          { name: "Rang", value: `\`#${rank}\``, inline: true },
          { name: "Progression", value: `${bar}  **${percent}%**` }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Erreur lors de la récupération du niveau :", err);
      return interaction.editReply({
        content: "Une erreur est survenue lors de la récupération du niveau."
      });
    }
  }
};
