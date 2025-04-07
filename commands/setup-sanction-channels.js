const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-sanction-channels")
    .setDescription("Ajouter ou retirer un salon (ou thread) pour surveiller les sanctions.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName("ajouter")
        .setDescription("Ajouter un salon pour la surveillance des sanctions.")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Salon ou thread à surveiller")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("retirer")
        .setDescription("Retirer un salon de la surveillance des sanctions.")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Salon ou thread à retirer")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
        )
    ),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const channel = interaction.options.getChannel("channel");
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === "ajouter") {
        await db.execute(
          "INSERT INTO sanction_watch_channels (guild_id, channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)",
          [guildId, channel.id]
        );
        return interaction.reply({
          content: `✅ Le salon <#${channel.id}> a été ajouté à la liste des salons surveillés pour les sanctions.`,
          ephemeral: true,
        });
      } else if (sub === "retirer") {
        await db.execute(
          "DELETE FROM sanction_watch_channels WHERE guild_id = ? AND channel_id = ?",
          [guildId, channel.id]
        );
        return interaction.reply({
          content: `✅ Le salon <#${channel.id}> a été retiré de la liste des salons surveillés pour les sanctions.`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la configuration des salons sanction :", error);
      return interaction.reply({
        content: "❌ Une erreur est survenue lors de la configuration.",
        ephemeral: true,
      });
    }
  },
};
