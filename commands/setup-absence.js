const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup-absence")
        .setDescription("Configure ou désactive le système d'absence")
        .addBooleanOption((option) =>
            option
                .setName("enabled")
                .setDescription("Activer (true) ou désactiver (false) le système d'absence")
                .setRequired(true)
        )
        .addRoleOption((option) =>
            option
                .setName("allowed_role")
                .setDescription("Rôle autorisé à utiliser la commande d'ajout d'absence")
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName("announcement_channel")
                .setDescription("Channel où les embeds d'absence seront envoyés")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true,
            });
        }

        const enabled = interaction.options.getBoolean("enabled");
        const allowedRole = interaction.options.getRole("allowed_role");
        const announcementChannel = interaction.options.getChannel("announcement_channel");

        try {
            await db.execute(
                `INSERT INTO absence_config (guild_id, is_enabled, allowed_role_id, announcement_channel_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            is_enabled = VALUES(is_enabled),
            allowed_role_id = VALUES(allowed_role_id),
            announcement_channel_id = VALUES(announcement_channel_id)`,
                [interaction.guild.id, enabled, allowedRole.id, announcementChannel.id]
            );

            return interaction.reply({
                content: `Configuration mise à jour :
- Système d'absence : **${enabled ? "activé" : "désactivé"}**
- Rôle autorisé : **${allowedRole.name}**
- Channel d'annonce : **${announcementChannel}**`,
                ephemeral: true,
            });
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la configuration d'absence :", error);
            return interaction.reply({
                content: "Une erreur s'est produite lors de la configuration du système d'absence.",
                ephemeral: true,
            });
        }
    },
};
