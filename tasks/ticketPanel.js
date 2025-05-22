const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const db = require("../db");

async function sendTicketPanel(client) {
  try {
    const guild = client.guilds.cache.first();
    const [configRows] = await db.execute(
      "SELECT channel_id, panel_message, button_names, ticket_messages, embed_thumbnail FROM ticket_config WHERE guild_id = ? LIMIT 1",
      [guild.id]
    );

    if (configRows.length === 0) {
      console.error("Aucune configuration de ticket trouvée.");
      return;
    }

    const { channel_id, panel_message, button_names, embed_thumbnail } =
      configRows[0];
    const buttonNames = JSON.parse(button_names);

    const channel = await client.channels.fetch(channel_id);
    if (!channel) {
      console.error(`Salon de ticket introuvable : ${channel_id}`);
      return;
    }

    const [existingMessages] = await db.execute(
      "SELECT message_id FROM embed_messages WHERE name = 'ticket_panel' AND channel_id = ?",
      [channel_id]
    );

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
      .setTimestamp();

    if (embed_thumbnail && embed_thumbnail.trim().length > 0) {
      embed.setThumbnail(embed_thumbnail);
    } else {
      console.log(
        "Aucun thumbnail personnalisé trouvé, utilisation d'aucun thumbnail."
      );
    }

    if (existingMessages.length > 0) {
      const existingMessageID = existingMessages[0].message_id;
      try {
        const existingMessage = await channel.messages.fetch(existingMessageID);
        if (existingMessage) {
          let needsUpdate = false;
          const oldEmbed = existingMessage.embeds[0];

          if (!oldEmbed || !oldEmbed.thumbnail || !oldEmbed.thumbnail.url) {
            needsUpdate = true;
          }
          if (needsUpdate) {
            const newEmbed = EmbedBuilder.from(embed);
            await existingMessage.edit({
              embeds: [newEmbed],
              components: [row],
            });
            console.log(
              "Panneau de ticket existant mis à jour avec le thumbnail."
            );
          } else {
            console.log(
              "Un panneau de ticket existe déjà et il est à jour. Aucun nouveau panneau ne sera envoyé."
            );
          }
          return;
        }
      } catch (error) {
        console.log(
          "L'ancien panneau de ticket est introuvable sur Discord. Suppression de l'enregistrement en base."
        );
        await db.execute("DELETE FROM embed_messages WHERE message_id = ?", [
          existingMessageID,
        ]);
      }
    }

    const message = await channel.send({ embeds: [embed], components: [row] });

    await db.execute(
      "INSERT INTO embed_messages (name, message_id, channel_id, guild_id) VALUES ('ticket_panel', ?, ?, ?)",
      [message.id, channel_id, guild.id]
    );

    console.log("Panneau de ticket envoyé avec succès.");
  } catch (error) {
    console.error("Erreur lors de l'envoi du panneau de ticket :", error);
  }
}

module.exports = { sendTicketPanel };
