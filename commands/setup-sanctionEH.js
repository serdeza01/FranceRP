const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup-sanctioneh")
        .setDescription("Configurer le système de sanctions EH")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Le salon où le bot lira les messages contenant les sanctions")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName("embed-channel")
                .setDescription("Le salon où envoyer l'embed de confirmation")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option.setName("role")
                .setDescription("Le rôle autorisé à utiliser la commande /sanction EH")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Vous devez être administrateur pour utiliser cette commande.", ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const channel = interaction.options.getChannel("channel");
        const embedChannel = interaction.options.getChannel("embed-channel");
        const allowedRole = interaction.options.getRole("role");
        const query = `
        INSERT INTO sanction_config (guild_id, channel_id, embed_channel_id, allowed_role_id)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), embed_channel_id = VALUES(embed_channel_id), allowed_role_id = VALUES(allowed_role_id)
      `;
        try {
            await db.execute(query, [guildId, channel.id, embedChannel.id, allowedRole.id]);

            const embed = new EmbedBuilder()
                .setTitle("Configuration sanctionEH enregistré !")
                .setDescription(`Salon de lecture: <#${channel.id}>
  Salon d'embed: <#${embedChannel.id}>
  Rôle autorisé: ${allowedRole.name}`)
                .setColor(0x00aaff)
                .setTimestamp();

            await embedChannel.send({ embeds: [embed] });

            return interaction.reply({ content: "✅ La configuration sanctionEH a été mise à jour avec succès.", ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "❌ Une erreur est survenue lors de la configuration.", ephemeral: true });
        }
    }
};
