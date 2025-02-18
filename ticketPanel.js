const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const db = require("./db");

const PANEL_CHANNEL_ID = "1304151485264822292";

async function sendTicketPanel(client) {
  try {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
    if (!channel) {
      console.error(`Channel ${PANEL_CHANNEL_ID} introuvable.`);
      return;
    }

    const file = new AttachmentBuilder("./image.png");
    const embed = new EmbedBuilder()
      .setTitle("📌 Support")
      .setDescription(
        "Sélectionnez votre type de demande :\n\n • 📩 Support : Problème en jeu, plainte, question.\n • 🚫 Unban : Contester ou expliquer un bannissement.\n • 🛠️ Gang : Créer ou modifier un gang.\n\nCliquez sur un bouton pour ouvrir un ticket."
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

    // Vérification dans la BDD si un panneau existe déjà
    const [rows] = await db.execute(
      "SELECT message_id FROM ticket_panel WHERE channel_id = ? LIMIT 1",
      [PANEL_CHANNEL_ID]
    );

    if (rows.length > 0 && rows[0].message_id) {
      let panelMessage;
      try {
        panelMessage = await channel.messages.fetch(rows[0].message_id);
      } catch (err) {
        console.error("Impossible de récupérer le message existant, un nouveau sera envoyé.", err);
        panelMessage = null;
      }

      if (panelMessage) {
        await panelMessage.edit({ embeds: [embed], components: [row], files: [file] });
        console.log("Panneau de ticket existant mis à jour dans le salon " + PANEL_CHANNEL_ID);
        return;
      }
    }

    const newMessage = await channel.send({ embeds: [embed], components: [row], files: [file] });
    console.log("Nouveau panneau de ticket envoyé dans le salon " + PANEL_CHANNEL_ID);

    const query = `
      INSERT INTO ticket_panel (channel_id, message_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE message_id = VALUES(message_id)
    `;
    await db.execute(query, [PANEL_CHANNEL_ID, newMessage.id]);
  } catch (error) {
    console.error("Erreur lors de l'envoi du panneau de ticket :", error);
  }
}

module.exports = { sendTicketPanel };