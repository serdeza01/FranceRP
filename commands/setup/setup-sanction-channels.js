const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-sanction-channels")
    .setDescription("Configurer les salons pour la surveillance des sanctions")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName("configurer")
        .setDescription("Configurer la surveillance des sanctions avec un salon initial")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Salon ou thread à surveiller")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
        .addChannelOption(option =>
          option
            .setName("embed-channel")
            .setDescription("Salon où envoyer l'embed de confirmation")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
          option
            .setName("role")
            .setDescription("Rôle autorisé pour les sanctions")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("ajouter")
        .setDescription("Ajouter un salon ou thread supplémentaire à la configuration existante")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Salon ou thread à ajouter (non déjà présent)")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("retirer")
        .setDescription("Retirer un salon ou thread de la surveillance des sanctions")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Salon ou thread à retirer")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "configurer") {
      const channel = interaction.options.getChannel("channel");
      const embedChannel = interaction.options.getChannel("embed-channel");
      const role = interaction.options.getRole("role");

      const channelsArray = [channel.id];

      try {
        const [rows] = await db.execute(
          "SELECT * FROM sanction_config WHERE guild_id = ?",
          [guildId]
        );
        if (rows.length) {
          await db.execute(
            "UPDATE sanction_config SET channel_ids = ?, embed_channel_id = ?, allowed_role_id = ? WHERE guild_id = ?",
            [JSON.stringify(channelsArray), embedChannel.id, role.id, guildId]
          );
        } else {
          await db.execute(
            "INSERT INTO sanction_config (guild_id, channel_ids, embed_channel_id, allowed_role_id) VALUES (?, ?, ?, ?)",
            [guildId, JSON.stringify(channelsArray), embedChannel.id, role.id]
          );
        }
        await interaction.reply({
          content: `Configuration enregistrée. Salon surveillé initial : <#${channel.id}>.`,
          ephemeral: true
        });
      } catch (err) {
        console.error("Erreur lors de la configuration des salons sanction :", err);
        await interaction.reply({
          content: "Erreur lors de la configuration des salons sanction.",
          ephemeral: true
        });
      }
    } else if (subcommand === "ajouter") {
      const channel = interaction.options.getChannel("channel");
      try {
        const [rows] = await db.execute(
          "SELECT channel_ids FROM sanction_config WHERE guild_id = ?",
          [guildId]
        );
        if (rows.length === 0) {
          await interaction.reply({
            content: "Aucune configuration existante. Utilisez d'abord la commande `/setup-sanction-channels configurer`.",
            ephemeral: true
          });
          return;
        }

        let channelsArray;
        try {
          channelsArray = JSON.parse(rows[0].channel_ids);
          if (!Array.isArray(channelsArray)) channelsArray = [];
        } catch (e) {
          channelsArray = [];
        }

        if (channelsArray.includes(channel.id)) {
          await interaction.reply({
            content: "Ce salon est déjà présent dans la configuration.",
            ephemeral: true
          });
          return;
        }
        channelsArray.push(channel.id);
        await db.execute(
          "UPDATE sanction_config SET channel_ids = ? WHERE guild_id = ?",
          [JSON.stringify(channelsArray), guildId]
        );
        await interaction.reply({
          content: `Salon <#${channel.id}> ajouté à la configuration.`,
          ephemeral: true
        });
      } catch (err) {
        console.error("Erreur lors de l'ajout d'un salon :", err);
        await interaction.reply({
          content: "Erreur lors de l'ajout du salon.",
          ephemeral: true
        });
      }
    } else if (subcommand === "retirer") {
      const channel = interaction.options.getChannel("channel");
      try {
        const [rows] = await db.execute(
          "SELECT channel_ids FROM sanction_config WHERE guild_id = ?",
          [guildId]
        );
        if (rows.length === 0) {
          await interaction.reply({
            content: "Aucune configuration trouvée.",
            ephemeral: true
          });
          return;
        }

        let channelsArray;
        try {
          channelsArray = JSON.parse(rows[0].channel_ids);
          if (!Array.isArray(channelsArray)) channelsArray = [];
        } catch (e) {
          channelsArray = [];
        }
        if (!channelsArray.includes(channel.id)) {
          await interaction.reply({
            content: "Ce salon n'est pas présent dans la configuration.",
            ephemeral: true
          });
          return;
        }
        channelsArray = channelsArray.filter(id => id !== channel.id);
        await db.execute(
          "UPDATE sanction_config SET channel_ids = ? WHERE guild_id = ?",
          [JSON.stringify(channelsArray), guildId]
        );
        await interaction.reply({
          content: `Salon <#${channel.id}> retiré de la configuration.`,
          ephemeral: true
        });
      } catch (err) {
        console.error("Erreur lors du retrait d'un salon sanction :", err);
        await interaction.reply({
          content: "Erreur lors du retrait du salon.",
          ephemeral: true
        });
      }
    }
  }
};
