const { EmbedBuilder } = require("discord.js");
const db = require("../db");

async function getPresenceConfig(guildId) {
  const [rows] = await db.execute("SELECT channel_id, role_id FROM presence_config WHERE guild_id = ?", [guildId]);
  return rows.length > 0 ? rows[0] : null;
}

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

async function getOrCreatePresenceMessage(client, guildId) {
  const config = await getPresenceConfig(guildId);
  if (!config) {
    throw new Error("La configuration de présence n'a pas été trouvée. Utilisez la commande `/setup_presence` pour configurer.");
  }

  const { channel_id } = config;
  const channel = await client.channels.fetch(channel_id);
  if (!channel) {
    throw new Error(`Salon de présence introuvable (ID: ${channel_id}). Vérifiez la configuration.`);
  }

  const [rows] = await db.execute("SELECT message_id FROM embed_messages WHERE name = 'presence' AND channel_id = ?", [channel_id]);

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
            INSERT INTO embed_messages (name, message_id, channel_id)
            VALUES ('presence', ?, ?)
            ON DUPLICATE KEY UPDATE message_id = VALUES(message_id), channel_id = VALUES(channel_id)
        `;
    await db.execute(query, [presenceMessage.id, channel_id]);
  }

  return presenceMessage;
}

async function updatePresenceEmbed(client, guildId) {
  const config = await getPresenceConfig(guildId);
  if (!config) {
    throw new Error("La configuration de présence n'a pas été trouvée. Utilisez la commande `/setup_presence` pour configurer.");
  }

  const { channel_id } = config;
  const channel = await client.channels.fetch(channel_id);
  if (!channel) {
    throw new Error(`Salon de présence introuvable (ID: ${channel_id}). Vérifiez la configuration.`);
  }

  const embed = await buildPresenceEmbed();
  const message = await channel.send({ embeds: [embed] });

  const query = `
        INSERT INTO embed_messages (name, message_id, channel_id)
        VALUES ('presence', ?, ?)
        ON DUPLICATE KEY UPDATE message_id = VALUES(message_id), channel_id = VALUES(channel_id)
    `;
  await db.execute(query, [message.id, channel_id]);

  return message;
}

async function handlePresenceCommand(interaction, client) {
  try {
    const config = await getPresenceConfig(interaction.guild.id);
    if (!config) {
      return interaction.reply({
        content: "La configuration de présence n'a pas été trouvée. Utilisez `/setup_presence` pour configurer.",
        ephemeral: true,
      });
    }

    const { role_id } = config;
    if (!interaction.member.roles.cache.has(role_id)) {
      return interaction.reply({
        content: "Vous n'êtes pas autorisé à mettre à jour votre présence.",
        ephemeral: true,
      });
    }

    const staffUser = interaction.user;
    const discordId = staffUser.id;
    const username = staffUser.username;
    const queryUpdate = `
            INSERT INTO staff_presence (user_id, username, present)
            VALUES (?, ?, true)
            ON DUPLICATE KEY UPDATE username = VALUES(username), present = true
        `;
    await db.execute(queryUpdate, [discordId, username]);

    const presenceMessage = await getOrCreatePresenceMessage(client, interaction.guild.id);
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

module.exports = { handlePresenceCommand, buildPresenceEmbed, getOrCreatePresenceMessage, updatePresenceEmbed };
