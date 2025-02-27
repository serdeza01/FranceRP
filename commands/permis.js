const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("permis")
    .setDescription("Affiche ton permis de conduire"),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const discordId = interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      const [results] = await db.execute(
        "SELECT * FROM permis WHERE guild_id = ? AND discord_id = ?",
        [guildId, discordId]
      );

      if (results.length === 0) {
        return interaction.editReply({
          content: "Tu n’as pas de permis enregistré sur ce serveur.",
        });
      }

      const permis = results[0];
      const file = new AttachmentBuilder(permis.image_path);
      const embed = new EmbedBuilder()
        .setTitle("📄 Permis de conduire")
        .setColor("#ff69b4")
        .setImage(`attachment://${permis.image_path.split("/").pop()}`)
        .setFooter({ text: `Expire le : ${permis.expiration_date}` });

      return interaction.editReply({ embeds: [embed], files: [file] });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.editReply({
        content: "Erreur lors de la récupération des données.",
      });
    }
  },
};
