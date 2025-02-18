const { EmbedBuilder } = require("discord.js");
const db = require("../db");

const PRESENCE_CHANNEL_ID = "1337086501778882580";

async function buildPresenceEmbed() {
  const [rows] = await db.execute("SELECT username, user_id FROM staff_presence WHERE present = true");
  let staffList = rows.map(row => `• ${row.username} (<@${row.user_id}>)`).join("\n");
  if (!staffList) staffList = "Aucun staff n'est actuellement présent.";

  const embed = new EmbedBuilder()
    .setTitle("Présence du Staff")
    .setDescription(staffList)
    .setColor(0x00aaff)
    .setTimestamp();
  return embed;
}

async function getOrCreatePresenceMessage(client) {
  const channel = await client.channels.fetch(PRESENCE_CHANNEL_ID);
  if (!channel) {
    throw new Error(`Channel ${PRESENCE_CHANNEL_ID} introuvable.`);
  }
  const [rows] = await db.execute("SELECT message_id FROM embed_messages WHERE name = 'presence'");

  let presenceMessage;

  if (rows.length > 0) {
    try {
      presenceMessage = await channel.messages.fetch(rows[0].message_id);
    } catch (err) {
      console.error("Message de présence introuvable, un nouveau sera envoyé.");
    }
  }

  if (!presenceMessage) {
    const embed = await buildPresenceEmbed();
    presenceMessage = await channel.send({ embeds: [embed] });
    const query = `
      INSERT INTO embed_messages (name, message_id)
      VALUES ('presence', ?)
      ON DUPLICATE KEY UPDATE message_id = VALUES(message_id)
    `;
    await db.execute(query, [presenceMessage.id]);
  }

  return presenceMessage;
}

async function handlePresenceCommand(interaction, client) {
  try {
    const staffUser = interaction.user;
    const discordId = staffUser.id;
    const username = staffUser.username;
    const queryUpdate = `
      INSERT INTO staff_presence (user_id, username, present)
      VALUES (?, ?, true)
      ON DUPLICATE KEY UPDATE username = VALUES(username), present = true
    `;
    await db.execute(queryUpdate, [discordId, username]);

    const presenceMessage = await getOrCreatePresenceMessage(client);
    const embed = await buildPresenceEmbed();
    await presenceMessage.edit({ embeds: [embed] });

    await interaction.reply({
      content: "Ton statut de présence a été mis à jour.",
      ephemeral: true
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la présence :", error);
    await interaction.reply({
      content: "Une erreur est survenue lors de la mise à jour de ta présence.",
      ephemeral: true
    });
  }
}

module.exports = { handlePresenceCommand };