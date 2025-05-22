const { EmbedBuilder } = require("discord.js");
const db = require("../db");

/**
 *
 * @param {Client} client
 * @param {Interaction} interaction
 * @param {Object} [options] - Options supplémentaires (ex: { affected: "nom_du_salon ou utilisateur" }).
 */
async function logCommandUsage(client, interaction, options = {}) {
  const user = interaction.user;
  const commandUsed = interaction.commandName;
  const now = new Date();
  const formattedDate = now.toLocaleString("fr-FR");
  const affected = options.affected || (interaction.channel ? interaction.channel.name : "MP");
  const guildName = interaction.guild ? interaction.guild.name : "Non défini";

  let commandParams = "Aucun argument fourni";
  if (interaction.options && interaction.options.data && interaction.options.data.length > 0) {
    commandParams = interaction.options.data
      .map((opt) => {
        if (opt.options && opt.options.length > 0) {
          const subOptions = opt.options
            .map((subOpt) => `${subOpt.name}: ${subOpt.value === undefined ? "N/A" : subOpt.value}`)
            .join("\n");
          return `• ${opt.name}:\n${subOptions}`;
        } else {
          return `• ${opt.name}: ${opt.value === undefined ? "N/A" : opt.value}`;
        }
      })
      .join("\n");
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Commande utilisée")
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: "Date/Heure", value: formattedDate, inline: true },
      { name: "Utilisateur", value: user.username, inline: true },
      { name: "Arobase", value: user.tag, inline: true },
      { name: "Commande", value: commandUsed, inline: true },
      { name: "Salon / Cible", value: affected, inline: true },
      { name: "Serveur", value: guildName, inline: true },
      { name: "Contenu de la commande", value: commandParams }
    )
    .setTimestamp();

  let logChannelId;
  const guildId = interaction.guild ? interaction.guild.id : null;
  if (guildId) {
    try {
      const [rows] = await db.execute("SELECT channel_id FROM log_config WHERE guild_id = ?", [guildId]);
      if (rows.length > 0) {
        logChannelId = rows[0].channel_id;
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de la configuration de log:", err);
    }
  }
  if (!logChannelId && process.env.LOG_CHANNEL_ID) {
    logChannelId = process.env.LOG_CHANNEL_ID;
  }

  if (logChannelId) {
    try {
      const logChannel = await client.channels.fetch(logChannelId);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      } else {
        console.error("Le salon de logs configuré est introuvable.");
      }
    } catch (err) {
      console.error("Erreur lors de l'envoi du log:", err);
    }
  } else {
    console.error("Aucune configuration de salon de logs trouvée pour cette guilde.");
  }

  try {
    await db.execute(
      `INSERT INTO command_logs (guild_id, user_id, command_name, channel, log_message)
       VALUES (?, ?, ?, ?, ?)`,
      [
        guildId,
        user.id,
        commandUsed,
        affected,
        embed.data ? JSON.stringify(embed.data) : null
      ]
    );
  } catch (err) {
    console.error("Erreur lors de la sauvegarde du log en BDD:", err);
  }

  try {
    const [rows] = await db.execute(
      "SELECT guild_id1, guild_id2 FROM linked_servers WHERE guild_id1 = ? OR guild_id2 = ?",
      [guildId, guildId]
    );
    for (const row of rows) {
      const linkedGuildId = row.guild_id1 === guildId ? row.guild_id2 : row.guild_id1;
      try {
        const [cfgRows] = await db.execute("SELECT channel_id FROM log_config WHERE guild_id = ?", [linkedGuildId]);
        if (cfgRows.length > 0) {
          const linkedLogChannelId = cfgRows[0].channel_id;
          if (linkedLogChannelId === logChannelId) continue;
          const linkedLogChannel = await client.channels.fetch(linkedLogChannelId);
          if (linkedLogChannel) {
            await linkedLogChannel.send({ embeds: [embed] });
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'envoi du log vers le serveur lié:", err);
      }
    }
  } catch (err) {
    console.error("Erreur lors de la récupération des serveurs liés:", err);
  }
}

module.exports = { logCommandUsage };
