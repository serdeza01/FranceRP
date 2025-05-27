const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionResponse } = require("discord.js");
const db = require("../../db");
const { syncUser } = require("../../tasks/users-backup-commands");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup-list")
        .setDescription("Affiche toutes vos sauvegardes enregistrées"),

    async execute(interaction) {
        await syncUser(interaction);
        const userId = interaction.user.id;
        const [[rows]] = await db.execute(`
            SELECT COUNT(*) as total FROM backups WHERE user_id = ?
        `, [userId]);

        const total = rows.total;
        if (total === 0) {
            return interaction.reply({
                content: "❌ Vous n'avez encore enregistré aucune sauvegarde.",
                ephemeral: true
            });
        }

        const [backups] = await db.execute(`
            SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 10 OFFSET 0
        `, [userId]);

        const embed = createBackupListEmbed(backups, 1, total);
        const row = createPaginationRow(1, total);

        await interaction.reply({
            embeds: [embed],
            components: total > 10 ? [row] : [],
            ephemeral: true
        });

        if (total > 10) {
            const collector = interaction.channel.createMessageComponentCollector({
                time: 60_000,
                filter: i => i.user.id === userId
            });

            let currentPage = 1;

            collector.on("collect", async btn => {
                if (btn.customId === "prev") currentPage--;
                if (btn.customId === "next") currentPage++;

                const [pageBackups] = await db.execute(`
                    SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 10 OFFSET ?
                `, [userId, (currentPage - 1) * 10]);

                const newEmbed = createBackupListEmbed(pageBackups, currentPage, total);
                const newRow = createPaginationRow(currentPage, total);

                await btn.update({ embeds: [newEmbed], components: [newRow] });
            });

            collector.on("end", async () => {
                const disabledRow = createPaginationRow(currentPage, total, true);
                await interaction.editReply({ components: [disabledRow] });
            });
        }
    }
};

function createBackupListEmbed(backups, page, total) {
    const embed = new EmbedBuilder()
        .setTitle("📋 Vos sauvegardes")
        .setColor(0x3498db)
        .setFooter({ text: `Page ${page} — Total : ${total} sauvegarde(s)` });

    for (const backup of backups) {
        embed.addFields({
            name: `🆔 ID ${backup.id} — ${backup.name}`,
            value: `🖥️ Serveur ID : \`${backup.guild_id}\`\n📅 Créée le : <t:${Math.floor(new Date(backup.created_at).getTime() / 1000)}:f>\n⚙️ Type : ${backup.automatic ? "Automatique" : "Manuelle"}`,
            inline: false
        });
    }

    return embed;
}

function createPaginationRow(currentPage, total, disabled = false) {
    const maxPages = Math.ceil(total / 10);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("⬅️ Précédent")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || currentPage === 1),
        new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Suivant ➡️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || currentPage === maxPages)
    );
}
