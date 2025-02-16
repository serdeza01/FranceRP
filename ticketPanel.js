// ticketPanel.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require("discord.js");

async function sendTicketPanel(client) {
  try {
    const channel = await client.channels.fetch("1304151485264822292");
    if (!channel) {
      console.error("Channel 1304151485264822292 introuvable.");
      return;
    }
    const file = new AttachmentBuilder("./image.png");
    const embed = new EmbedBuilder()
      .setTitle("Support")
      .setDescription(
        "Pour toute demande d'aide, d'unban ou de création d'un gang merci de sélectionnez le type de ticket avec les 3 boutons ci-dessous."
      )
      .setColor(0x00aaff)
      .setThumbnail("attachment://image.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_support")
        .setLabel("Demande de support")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_unban")
        .setLabel("Demande d'unban")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_gang")
        .setLabel("Création de gang")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row], files: [file] });
    console.log("Panneau de ticket envoyé dans le salon 1304151485264822292.");
  } catch (error) {
    console.error("Erreur lors de l'envoi du panneau de ticket:", error);
  }
}

module.exports = { sendTicketPanel };
