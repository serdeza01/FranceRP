const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setlogchannel")
        .setDescription("Configure le salon de logs destiné à recevoir les logs d’un serveur")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName("channel_id")
                .setDescription("L'ID du salon de logs (le bot doit y avoir accès)")
                .setRequired(true)
        ),
    async execute(interaction) {
        const channelId = interaction.options.getString("channel_id");

        let channel;
        try {
            channel = await interaction.client.channels.fetch(channelId);
            if (!channel) {
                return interaction.reply({
                    content: "Salon introuvable ou inaccessible.",
                    ephemeral: true,
                });
            }
        } catch (error) {
            console.error("Erreur lors de la récupération du salon:", error);
            return interaction.reply({
                content: "Erreur lors de la récupération du salon. Vérifiez l'ID.",
                ephemeral: true,
            });
        }

        const guildId = interaction.guild ? interaction.guild.id : null;
        try {
            await db.execute(
                `INSERT INTO log_config (guild_id, channel_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE channel_id = ?`,
                [guildId, channelId, channelId]
            );
            const embed = new EmbedBuilder()
                .setTitle("Salon de logs configuré")
                .setDescription(
                    `Les logs de ce serveur (et ceux des serveurs liés si configurés) seront envoyés dans <#${channelId}>.`
                )
                .setColor(0x00ff00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error("Erreur lors de la sauvegarde de la configuration:", err);
            return interaction.reply({
                content: "Erreur lors de la sauvegarde de la configuration.",
                ephemeral: true,
            });
        }
    },
};
