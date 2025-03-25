const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("carte-grise")
    .setDescription("Affiche ta carte grise"),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const discordId = interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      const [results] = await db.execute(
        "SELECT * FROM carte-grise WHERE guild_id = ? AND discord_id = ?",
        [guildId, discordId]
      );

      if (results.length === 0) {
        return interaction.editReply({
          content: "Tu n'as pas de carte grise enregistrée sur ce serveur.",
          ephemeral: true
        });
      }

      const CarteGrise = results[0];
      const file = new AttachmentBuilder(CarteGrise.image_path);
      const embed = new EmbedBuilder()
        .setTitle("🛡 Carte Grise")
        .setColor("#ffcc00")
        .setImage(`attachment://${CarteGrise.image_path.split("/").pop()}`);

      return interaction.editReply({ embeds: [embed], files: [file] });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.editReply({
        content: "Erreur lors de la récupération des données.",
      });
    }
  },
};
