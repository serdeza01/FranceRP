const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Affiche le classement des niveaux (10 par page)"),
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const [results] = await db.execute(
      "SELECT discord_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC",
      [guildId]
    );
    if (results.length === 0) {
      return interaction.editReply("Aucun niveau enregistré pour ce serveur", ephemeral = true);
    }
    let currentPage = 0;
    const itemsPerPage = 10;

    const generateEmbed = page => {
      const start = page * itemsPerPage;
      const pageItems = results.slice(start, start + itemsPerPage);
      let description = "";
      pageItems.forEach((r, index) => {
        description += `**${start + index + 1}.** <@${r.discord_id}> - Niveau ${r.level} (XP : ${r.xp})\n`;
      });
      const embed = new EmbedBuilder()
        .setTitle("Leaderboard - Niveaux")
        .setDescription(description)
        .setFooter({ text: `Page ${page + 1} sur ${Math.ceil(results.length / itemsPerPage)}` });
      return embed;
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("Précédent")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Suivant")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(results.length <= itemsPerPage)
    );

    const message = await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: [row] });

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 180000 });

    collector.on("collect", async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "Vous n'êtes pas autorisé à utiliser ces boutons.", ephemeral: true });
      }
      if (i.customId === "prev") {
        currentPage--;
      } else if (i.customId === "next") {
        currentPage++;
      }
      const totalPages = Math.ceil(results.length / itemsPerPage);
      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("Précédent")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Suivant")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages - 1)
      );
      await i.update({ embeds: [generateEmbed(currentPage)], components: [newRow] });
    });

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("Précédent").setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId("next").setLabel("Suivant").setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      interaction.editReply({ components: [disabledRow] });
    });
  },
};
