const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("historique")
        .setDescription("Affiche l'historique des sanctions d'un utilisateur")
        .addUserOption((option) =>
            option.setName("target").setDescription("Utilisateur à rechercher").setRequired(true)
        ),
    async execute(interaction) {
        const target = interaction.options.getUser("target");
        const guildId = interaction.guild.id;

        let [configRows] = await db.execute(
            "SELECT role_id FROM ticket_config WHERE guild_id = ?",
            [guildId]
        );
        if (!configRows || configRows.length === 0) {
            return interaction.reply({
                content: "Configuration introuvable pour les commandes de modération.",
                ephemeral: true,
            });
        }
        const requiredRoleId = configRows[0].role_id;

        if (!interaction.member.roles.cache.has(requiredRoleId)) {
            return interaction.reply({
                content: "Vous n'êtes pas autorisé à utiliser cette commande.",
                ephemeral: true,
            });
        }

        const formatSanction = (sanction, fieldNames) => {
            return sanction
                .map((row) => {
                    let date = new Date(row[fieldNames.timestamp]).toLocaleString();
                    return `• Sanction par <@${row[fieldNames.executor]}>
Raison : ${row[fieldNames.reason] || "Aucune raison"}
Durée : ${row[fieldNames.duration] ? row[fieldNames.duration] : "N/A"}
Date : ${date}`;
                })
                .join("\n\n");
        };

        try {
            const [banRows] = await db.execute(
                "SELECT * FROM Ban WHERE target_id = ? AND guild_id = ? ORDER BY timestamp DESC",
                [target.id, guildId]
            );
            const [unbanRows] = await db.execute(
                "SELECT * FROM Unban WHERE target_id = ? AND guild_id = ? ORDER BY timestamp DESC",
                [target.id, guildId]
            );
            const [kickRows] = await db.execute(
                "SELECT * FROM Kick WHERE target_id = ? AND guild_id = ? ORDER BY timestamp DESC",
                [target.id, guildId]
            );
            const [timeoutRows] = await db.execute(
                "SELECT * FROM timeout WHERE target_id = ? AND guild_id = ? ORDER BY timestamp DESC",
                [target.id, guildId]
            );
            const [blacklistRows] = await db.execute(
                "SELECT * FROM Blacklist WHERE user_id = ? AND guild_id = ? ORDER BY timestamp DESC",
                [target.id, guildId]
            );

            const embed = new EmbedBuilder()
                .setTitle(`Historique de sanctions : ${target.tag}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor(0x00aaff)
                .setFooter({ text: `Demandé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            if (banRows.length) {
                embed.addFields({
                    name: "Bans",
                    value: formatSanction(banRows, {
                        executor: "executor_id",
                        reason: "reason",
                        duration: "duration",
                        timestamp: "timestamp",
                    }),
                });
            } else {
                embed.addFields({ name: "Bans", value: "Aucun ban enregistré." });
            }

            // Section Unbans
            if (unbanRows.length) {
                embed.addFields({
                    name: "Unbans",
                    value: formatSanction(unbanRows, {
                        executor: "executor_id",
                        reason: "reason",
                        timestamp: "timestamp",
                    }),
                });
            } else {
                embed.addFields({ name: "Unbans", value: "Aucun unban enregistré." });
            }

            if (kickRows.length) {
                embed.addFields({
                    name: "Kicks",
                    value: formatSanction(kickRows, {
                        executor: "executor_id",
                        reason: "reason",
                        duration: "duration",
                        timestamp: "timestamp",
                    }),
                });
            } else {
                embed.addFields({ name: "Kicks", value: "Aucun kick enregistré." });
            }

            // Section Timeouts
            if (timeoutRows.length) {
                embed.addFields({
                    name: "Timeouts",
                    value: formatSanction(timeoutRows, {
                        executor: "executor_id",
                        reason: "reason",
                        duration: "duration",
                        timestamp: "timestamp",
                    }),
                });
            } else {
                embed.addFields({ name: "Timeouts", value: "Aucun timeout enregistré." });
            }

            if (blacklistRows.length) {
                const formattedBlacklist = blacklistRows
                    .map((row) => {
                        const sanctionDate = new Date(row.timestamp).toLocaleString();
                        const accountCreation = row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : "Inconnue";
                        const joinedAt = row.joined_at
                            ? new Date(row.joined_at).toLocaleString()
                            : "Inconnue";
                        return `• Blacklist par <@${row.executor_id}>
Raison : ${row.reason || "Aucune raison"}
Durée : ${row.duration ? row.duration : "N/A"}
Date de sanction : ${sanctionDate}
Compte créé le : ${accountCreation}
Rejoint le serveur le : ${joinedAt}`;
                    })
                    .join("\n\n");

                embed.addFields({ name: "Blacklist", value: formattedBlacklist });
            } else {
                embed.addFields({ name: "Blacklist", value: "Aucune entrée en blacklist." });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("Erreur lors de la récupération de l'historique :", error);
            await interaction.reply({
                content: "Une erreur est survenue lors de la récupération de l'historique.",
                ephemeral: true,
            });
        }
    },
};
