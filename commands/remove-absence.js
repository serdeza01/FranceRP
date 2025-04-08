const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("removeabsence")
        .setDescription("Supprime une absence que vous avez créée")
        .addStringOption((option) =>
            option
                .setName("absence_id")
                .setDescription("L'ID de l'absence à supprimer")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const absenceIdInput = interaction.options.getString("absence_id");
        const absenceId = parseInt(absenceIdInput, 10);
        if (isNaN(absenceId)) {
            return interaction.editReply("❌ L'ID de l'absence doit être un nombre valide.");
        }

        try {
            const [configRows] = await db.execute(
                "SELECT is_enabled, announcement_channel_id FROM absence_config WHERE guild_id = ?",
                [interaction.guild.id]
            );
            if (!configRows.length || !configRows[0].is_enabled) {
                return interaction.editReply("❌ Le système d'absence n'est pas activé sur ce serveur.");
            }
            const announcementChannelId = configRows[0].announcement_channel_id;
            const announcementChannel = interaction.guild.channels.cache.get(announcementChannelId);
            if (!announcementChannel) {
                return interaction.editReply("❌ Channel d'annonce introuvable.");
            }

            const [rows] = await db.execute(
                "SELECT * FROM absences WHERE id = ? AND guild_id = ?",
                [absenceId, interaction.guild.id]
            );
            if (!rows.length) {
                return interaction.editReply(`❌ Aucune absence trouvée avec l'ID ${absenceId}.`);
            }
            const absence = rows[0];

            if (absence.user_id !== interaction.user.id) {
                return interaction.editReply("❌ Vous ne pouvez supprimer que vos propres absences.");
            }

            function convertToDisplayDate(sqlDate) {
                let dateStr;
                if (typeof sqlDate === "string") {
                    dateStr = sqlDate;
                } else if (sqlDate instanceof Date) {
                    dateStr = sqlDate.toISOString().split("T")[0];
                } else {
                    dateStr = String(sqlDate);
                }
                const parts = dateStr.split("-");
                if (parts.length !== 3) return sqlDate;
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            const dateDebutDisplay = convertToDisplayDate(absence.date_debut);
            const dateFinDisplay = convertToDisplayDate(absence.date_fin);

            await db.execute(
                "DELETE FROM absences WHERE id = ? AND guild_id = ?",
                [absenceId, interaction.guild.id]
            );

            const embed = new EmbedBuilder()
                .setTitle("Absence supprimée")
                .setColor(0xff0000)
                .addFields(
                    { name: "Utilisateur", value: interaction.user.username, inline: true },
                    { name: "Date de début", value: dateDebutDisplay, inline: true },
                    { name: "Date de fin", value: dateFinDisplay, inline: true }
                )
                .setFooter({ text: `ID de l'absence supprimée: ${absenceId}` })
                .setTimestamp();

            await announcementChannel.send({ embeds: [embed] });

            return interaction.editReply(`✅ Votre absence (ID: ${absenceId}) a bien été supprimée.`);
        } catch (error) {
            console.error("Erreur lors de la suppression de l'absence :", error);
            if (!interaction.replied) {
                return interaction.editReply("❌ Une erreur s'est produite lors de la suppression de l'absence.");
            }
        }
    },
};
