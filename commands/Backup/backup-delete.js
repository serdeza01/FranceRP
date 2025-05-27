const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    SystemChannelFlagsBitField
} = require("discord.js");
const db = require("../../db");
const { syncUser } = require("../../tasks/users-backup-commands");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup-delete")
        .setDescription("Supprime une sauvegarde existante après confirmation")
        .addIntegerOption(opt =>
            opt.setName("id")
                .setDescription("ID de la sauvegarde à supprimer")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await syncUser(interaction);
        const backupId = interaction.options.getInteger("id");
        const userId = interaction.user.id;

        const [rows] = await db.execute(`
            SELECT * FROM backups WHERE id = ? AND user_id = ?
        `, [backupId, userId]);

        if (rows.length === 0) {
            return interaction.reply({
                content: "❌ Aucune sauvegarde trouvée avec cet ID vous appartenant.",
                ephemeral: true
            });
        }

        const backupName = rows[0].name;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_delete")
                .setLabel("✅ Confirmer la suppression")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("cancel_delete")
                .setLabel("❌ Annuler")
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            content: `⚠️ Vous êtes sur le point de supprimer la sauvegarde **${backupName}** (ID: ${backupId}). Cette action est irréversible. Confirmez-vous ?`,
            components: [row],
            ephemeral: true
        });

        const confirmation = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 15000,
            filter: i => i.user.id === userId
        }).catch(() => null);

        if (!confirmation) {
            return interaction.editReply({
                content: "⏱️ Temps écoulé. Suppression annulée.",
                components: []
            });
        }

        if (confirmation.customId === "cancel_delete") {
            return confirmation.update({
                content: "❌ Suppression annulée.",
                components: []
            });
        }

        await db.execute(`DELETE FROM backups WHERE id = ? AND user_id = ?`, [backupId, userId]);

        return confirmation.update({
            content: `✅ Sauvegarde **${backupName}** (ID: ${backupId}) supprimée avec succès.`,
            components: []
        });
    }
};
