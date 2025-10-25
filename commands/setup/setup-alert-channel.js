const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup-alert-channel")
        .setDescription("[ADMIN] Configure le salon où les logs de manquements de sanctions seront postés.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption((option) =>
            option
                .setName("salon")
                .setDescription("Le salon texte où les alertes d'audit seront envoyées.")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guildId;
        const alertChannel = interaction.options.getChannel("salon");

        try {
            await db.execute(
                `UPDATE sanction_config SET admin_alert_channel_id = ? WHERE guild_id = ?`,
                [alertChannel.id, guildId]
            );

            return interaction.editReply({
                content: `✅ Le salon d'alerte Admin pour les manquements de sanctions est maintenant <#${alertChannel.id}>.`,
                ephemeral: true,
            });

        } catch (error) {
            console.error("Erreur lors de la configuration du salon d'alerte admin :", error);
            return interaction.editReply({
                content: "❌ Une erreur est survenue. Avez-vous exécuté `/setup-sanction-channels initialiser` au moins une fois?",
                ephemeral: true,
            });
        }
    },
};