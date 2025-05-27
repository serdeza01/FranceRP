const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const { syncUser } = require("../../tasks/users-backup-commands");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup-auto")
        .setDescription("Active ou désactive les sauvegardes automatiques")
        .addBooleanOption(opt =>
            opt.setName("activer")
                .setDescription("Activer ou désactiver les backups auto")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("intervalle")
                .setDescription("Intervalle entre chaque sauvegarde")
                .addChoices(
                    { name: "Toutes les 24h", value: "24" },
                    { name: "Chaque semaine", value: "168" }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await syncUser(interaction);
        const activer = interaction.options.getBoolean("activer");
        const interval = interaction.options.getString("intervalle");
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        if (!activer) {
            await db.execute(`DELETE FROM auto_backup_settings WHERE guild_id = ?`, [guildId]);
            return interaction.reply({
                content: "⛔️ Sauvegardes automatiques désactivées pour ce serveur.",
                ephemeral: true
            });
        }

        const hours = parseInt(interval || "24");

        await db.execute(`
            INSERT INTO auto_backup_settings (guild_id, user_id, interval_hours)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), interval_hours = VALUES(interval_hours)
        `, [guildId, userId, hours]);

        return interaction.reply({
            content: `✅ Sauvegardes automatiques activées toutes les ${hours}h sur ce serveur.`,
            ephemeral: true
        });
    }
};
