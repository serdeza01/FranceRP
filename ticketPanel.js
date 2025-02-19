const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const db = require("./db");

async function sendTicketPanel(client) {
  try {
    const guild = client.guilds.cache.first();
    const [rows] = await db.execute(
      "SELECT channel_id, panel_message, button_names, ticket_messages FROM ticket_config WHERE guild_id = ? LIMIT 1",
      [guild.id]
    );

    if (rows.length === 0) {
      console.error("Aucune configuration de ticket trouvée.");
      return;
    }

    const { channel_id, panel_message, button_names, ticket_messages } = rows[0];
    const buttonNames = JSON.parse(button_names);
    const ticketMessages = JSON.parse(ticket_messages);

    const channel = await client.channels.fetch(channel_id);
    if (!channel) {
      console.error(`Salon de ticket introuvable : ${channel_id}`);
      return;
    }

    const [existingMessages] = await db.execute(
      "SELECT message_id FROM embed_messages WHERE name = 'ticket_panel' AND channel_id = ?",
      [channel_id]
    );

    if (existingMessages.length > 0) {
      console.log("Un panneau de ticket existe déjà. Aucun nouveau panneau ne sera envoyé.");
      return;
    }

    const row = new ActionRowBuilder();
    buttonNames.forEach((name, index) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_${index}`)
          .setLabel(name)
          .setStyle(ButtonStyle.Primary)
      );
    });

    const embed = new EmbedBuilder()
      .setTitle("📌 Support")
      .setDescription(panel_message)
      .setColor(0x00aaff)
      .setThumbnail("attachment://image.png");

    const message = await channel.send({ embeds: [embed], components: [row] });

    await db.execute(
      "INSERT INTO embed_messages (name, message_id, channel_id) VALUES ('ticket_panel', ?, ?)",
      [message.id, channel_id]
    );

    console.log("Panneau de ticket envoyé avec succès.");
  } catch (error) {
    console.error("Erreur lors de l'envoi du panneau de ticket :", error);
  }
}

module.exports = { sendTicketPanel };