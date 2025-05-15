const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require("discord.js");
const db = require("../../db");

const EPHEMERAL_FLAG = 1 << 6;

/**
 * Scanne un salon texte, un thread ou un forum.
 * Si c'est un forum, on itère sur chacun de ses threads actifs.
 * Enregistre les sanctions et envoie un embed de contrôle.
 */
async function scanAndRegisterSanctions(channel, embedChannel, guildId) {
  if (channel.type === ChannelType.GuildForum) {
    const fetched = await channel.threads.fetchActive();
    for (const thread of fetched.threads.values()) {
      await scanAndRegisterSanctions(thread, embedChannel, guildId);
    }
    return;
  }

  const regex = /^Pseudo\s*:\s*(.+)\nRaison\s*:\s*(.+)\nSanction\s*:\s*(.+)$/i;
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const fetched = await channel.messages.fetch(options);
    if (!fetched.size) break;
    lastId = fetched.last().id;

    for (const message of fetched.values()) {
      const m = message.content.match(regex);
      if (!m) continue;

      const [, pseudoRaw, raisonRaw, sanctionRaw] = m;
      const pseudo = pseudoRaw.trim();
      const raison = raisonRaw.trim();
      let duration = "";
      const durRegex = /^(\d+)\s*([JMA])$/i;

      if (/^warn$/i.test(sanctionRaw)) duration = "Warn";
      else if (/^kick$/i.test(sanctionRaw)) duration = "Kick";
      else if (durRegex.test(sanctionRaw)) {
        const [, n, u] = sanctionRaw.match(durRegex);
        const unite =
          u.toUpperCase() === "J" ? "jour(s)" :
            u.toUpperCase() === "M" ? "mois" :
              "an(s)";
        duration = `${n} ${unite}`;
      }
      else if (/^(perm|permanent)$/i.test(sanctionRaw)) duration = "Permanent";
      else continue;

      const dateApplication = message.createdAt;

      await db.execute(
        `INSERT INTO sanctions
           (guild_id, punisher_id, pseudo, raison, duration, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          guildId,
          message.author.id,
          pseudo,
          raison,
          duration,
          dateApplication
        ]
      );

      const embed = new EmbedBuilder()
        .setTitle("Nouvelle sanction enregistrée")
        .addFields(
          { name: "Sanctionné par", value: `<@${message.author.id}>`, inline: true },
          { name: "Pseudo", value: pseudo, inline: true },
          { name: "Raison", value: raison, inline: true },
          { name: "Durée", value: duration, inline: true },
          { name: "Date", value: dateApplication.toLocaleString(), inline: true }
        )
        .setColor("Red")
        .setTimestamp();

      await embedChannel.send({ embeds: [embed] });
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-sanction-channels")
    .setDescription("Configure les salons / threads / forums à scanner pour les sanctions")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("initialiser")
        .setDescription("Définit le salon d'embed et la première liste de salons à scanner")
        .addChannelOption(opt =>
          opt
            .setName("embed")
            .setDescription("Salon où seront postés les embeds de contrôle")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(opt =>
          opt
            .setName("salon")
            .setDescription("Salon / thread / forum à scanner")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildForum,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("ajouter")
        .setDescription("Ajoute un salon / thread / forum à la configuration existante")
        .addChannelOption(opt =>
          opt
            .setName("salon")
            .setDescription("Salon / thread / forum à ajouter")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildForum,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("retirer")
        .setDescription("Retire un salon / thread / forum de la configuration")
        .addChannelOption(opt =>
          opt
            .setName("salon")
            .setDescription("Salon / thread / forum à retirer")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildForum,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === "initialiser") {
        const embedCh = interaction.options.getChannel("embed");
        const salon = interaction.options.getChannel("salon");

        await db.execute(
          `INSERT INTO sanction_config
             (guild_id, embed_channel_id, channel_ids)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             embed_channel_id = VALUES(embed_channel_id),
             channel_ids      = VALUES(channel_ids)`,
          [guildId, embedCh.id, JSON.stringify([salon.id])]
        );

        await interaction.reply({
          content: `Initialisation terminée.\nEmbed dans <#${embedCh.id}>, scan de <#${salon.id}>.`,
          flags: EPHEMERAL_FLAG
        });

        await scanAndRegisterSanctions(salon, embedCh, guildId);
      }
      else if (sub === "ajouter" || sub === "retirer") {
        const salon = interaction.options.getChannel("salon");
        const [rows] = await db.execute(
          `SELECT embed_channel_id, channel_ids
             FROM sanction_config
            WHERE guild_id = ?`,
          [guildId]
        );
        if (!rows.length) {
          return interaction.reply({
            content: "Aucune configuration trouvée, faites `/setup-sanction-channels initialiser` d’abord.",
            flags: EPHEMERAL_FLAG
          });
        }

        const cfg = rows[0];
        let channelIds = JSON.parse(cfg.channel_ids);

        if (sub === "ajouter") {
          if (channelIds.includes(salon.id)) {
            return interaction.reply({
              content: "Ce salon/thread/forum est déjà configuré.",
              flags: EPHEMERAL_FLAG
            });
          }
          channelIds.push(salon.id);
        }
        else {
          if (!channelIds.includes(salon.id)) {
            return interaction.reply({
              content: "Ce salon/thread/forum n'est pas dans la configuration.",
              flags: EPHEMERAL_FLAG
            });
          }
          channelIds = channelIds.filter(id => id !== salon.id);
        }

        await db.execute(
          `UPDATE sanction_config
              SET channel_ids = ?
            WHERE guild_id = ?`,
          [JSON.stringify(channelIds), guildId]
        );

        await interaction.reply({
          content: sub === "ajouter"
            ? `Ajouté <#${salon.id}> à la configuration.`
            : `Retiré <#${salon.id}> de la configuration.`,
          flags: EPHEMERAL_FLAG
        });

        if (sub === "ajouter") {
          const embedCh = await interaction.guild.channels.fetch(cfg.embed_channel_id);
          await scanAndRegisterSanctions(salon, embedCh, guildId);
        }
      }
    }
    catch (err) {
      console.error("Erreur dans /setup-sanction-channels :", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "Une erreur est survenue, regarde la console.",
          flags: EPHEMERAL_FLAG
        });
      }
    }
  }
};
