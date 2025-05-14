const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../db");

function convertToDisplayDate(sqlDate) {
    if (sqlDate instanceof Date) {
        const day = String(sqlDate.getDate()).padStart(2, "0");
        const month = String(sqlDate.getMonth() + 1).padStart(2, "0");
        const year = sqlDate.getFullYear();
        return `${day}/${month}/${year}`;
    }
    if (typeof sqlDate === "string") {
        const parts = sqlDate.split("-");
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    return String(sqlDate);
}

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
                "SELECT announcement_channel_id FROM absence_config WHERE guild_id = ?",
                [interaction.guild.id]
            );
            let announcementChannel = null;
            if (configRows.length) {
                const announcementChannelId = configRows[0].announcement_channel_id;
                announcementChannel = interaction.guild.channels.cache.get(announcementChannelId);
            }

            const [absenceRows] = await db.execute(
                "SELECT * FROM absences WHERE id = ? AND guild_id = ?",
                [absenceId, interaction.guild.id]
            );
            if (!absenceRows.length) {
                return interaction.editReply("❌ Aucune absence trouvée avec cet ID.");
            }
            const absence = absenceRows[0];

            if (absence.user_id !== interaction.user.id) {
                return interaction.editReply("❌ Vous ne pouvez supprimer que vos propres absences.");
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
                .setFooter({ text: `ID de l'absence supprimée : ${absenceId}` })
                .setTimestamp();

            if (announcementChannel) {
                await announcementChannel.send({ embeds: [embed] });
            } else {
                console.error("Le salon d'annonce est introuvable.");
            }

            return interaction.editReply(`✅ Votre absence (ID: ${absenceId}) a bien été supprimée.`);
        } catch (error) {
            console.error("Erreur lors de la suppression de l'absence :", error);
            return interaction.editReply("❌ Une erreur s'est produite lors de la suppression de l'absence.");
        }
    },
};
