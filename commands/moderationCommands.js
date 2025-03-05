const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mod")
        .setDescription("Commandes de modération : ban, unban, kick, timeout, blacklist")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("ban")
                .setDescription("Ban un membre")
                .addUserOption((option) =>
                    option.setName("target").setDescription("Membre à bannir").setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName("reason").setDescription("Raison du ban")
                )
                .addStringOption((option) =>
                    option.setName("duration").setDescription("Durée du ban (optionnel)")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("unban")
                .setDescription("Déban un utilisateur")
                .addStringOption((option) =>
                    option
                        .setName("targetid")
                        .setDescription("ID de l'utilisateur à débannir")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName("reason").setDescription("Raison du débannissement")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("kick")
                .setDescription("Expulse un membre")
                .addUserOption((option) =>
                    option.setName("target").setDescription("Membre à expulser").setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName("reason").setDescription("Raison de l'expulsion")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("timeout")
                .setDescription("Met en timeout un membre")
                .addUserOption((option) =>
                    option.setName("target").setDescription("Membre à timeout").setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("duration")
                        .setDescription("Durée du timeout en minutes")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName("reason").setDescription("Raison du timeout")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("blacklist")
                .setDescription("Blacklist un utilisateur (similaire au ban avec récupération des informations)")
                .addUserOption((option) =>
                    option.setName("target").setDescription("Utilisateur à blacklist").setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName("reason").setDescription("Raison de la blacklist").setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName("duration").setDescription("Durée (optionnel)")
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
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

        const executorId = interaction.user.id;
        const timestamp = new Date();

        if (subcommand === "ban") {
            const target = interaction.options.getUser("target");
            const reason = interaction.options.getString("reason") || "Aucune raison fournie";
            const duration = interaction.options.getString("duration") || null;

            try {
                await interaction.guild.members.ban(target, { reason });

                await db.execute(
                    "INSERT INTO Ban (guild_id, executor_id, target_id, target_mention, target_username, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        guildId,
                        executorId,
                        target.id,
                        target.tag,
                        target.username,
                        reason,
                        duration,
                        timestamp,
                    ]
                );
                await interaction.reply({
                    content: `${target.tag} a été banni.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error("Erreur lors du ban :", err);
                await interaction.reply({
                    content: "Erreur lors du ban de l'utilisateur.",
                    ephemeral: true,
                });
            }
        }

        else if (subcommand === "unban") {
            const targetId = interaction.options.getString("targetid");
            const reason = interaction.options.getString("reason") || "Aucune raison fournie";

            try {
                await interaction.guild.bans.remove(targetId, reason);
                await db.execute(
                    "INSERT INTO Unban (guild_id, executor_id, target_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)",
                    [guildId, executorId, targetId, reason, timestamp]
                );
                await interaction.reply({
                    content: `L'utilisateur avec l'ID ${targetId} a été débanni.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error("Erreur lors du débannissement :", err);
                await interaction.reply({
                    content: "Erreur lors du débannissement de l'utilisateur.",
                    ephemeral: true,
                });
            }
        }

        else if (subcommand === "kick") {
            const target = interaction.options.getUser("target");
            const reason = interaction.options.getString("reason") || "Aucune raison fournie";
            const duration = interaction.options.getString("duration") || null;

            try {
                const member = await interaction.guild.members.fetch(target.id);
                await member.kick(reason);
                await db.execute(
                    "INSERT INTO Kick (guild_id, executor_id, target_id, target_mention, target_username, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        guildId,
                        executorId,
                        target.id,
                        target.tag,
                        target.username,
                        reason,
                        duration,
                        timestamp,
                    ]
                );
                await interaction.reply({
                    content: `${target.tag} a été expulsé.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error("Erreur lors de l'expulsion :", err);
                await interaction.reply({
                    content: "Erreur lors de l'expulsion de l'utilisateur.",
                    ephemeral: true,
                });
            }
        }

        else if (subcommand === "timeout") {
            const target = interaction.options.getUser("target");
            const durationMinutes = interaction.options.getInteger("duration");
            const reason = interaction.options.getString("reason") || "Aucune raison fournie";
            const durationMs = durationMinutes * 60 * 1000;

            try {
                const member = await interaction.guild.members.fetch(target.id);
                await member.timeout(durationMs, reason);
                await db.execute(
                    "INSERT INTO timeout (guild_id, executor_id, target_id, target_mention, target_username, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        guildId,
                        executorId,
                        target.id,
                        target.tag,
                        target.username,
                        reason,
                        `${durationMinutes} minutes`,
                        timestamp,
                    ]
                );
                await interaction.reply({
                    content: `${target.tag} a été mis en timeout pendant ${durationMinutes} minutes.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error("Erreur lors du timeout :", err);
                await interaction.reply({
                    content: "Erreur lors de la mise en timeout de l'utilisateur.",
                    ephemeral: true,
                });
            }
        }

        else if (subcommand === "blacklist") {
            const target = interaction.options.getUser("target");
            const reason = interaction.options.getString("reason");
            const duration = interaction.options.getString("duration") || null;

            try {
                await interaction.guild.members.ban(target, { reason });

                const memberProfile = await interaction.guild.members
                    .fetch(target.id)
                    .catch(() => null);
                const joinedAt = memberProfile ? memberProfile.joinedAt : null;
                const createdAt = target.createdAt;
                const avatarUrl = target.displayAvatarURL({ dynamic: true });

                await db.execute(
                    "INSERT INTO Blacklist (guild_id, executor_id, user_id, username, user_tag, avatar_url, joined_at, created_at, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        guildId,
                        executorId,
                        target.id,
                        target.username,
                        target.tag,
                        avatarUrl,
                        joinedAt
                            ? joinedAt.toISOString().slice(0, 19).replace("T", " ")
                            : null,
                        createdAt.toISOString().slice(0, 19).replace("T", " "),
                        reason,
                        duration,
                        timestamp,
                    ]
                );
                await db.execute(
                    "INSERT INTO Ban (guild_id, executor_id, target_id, target_mention, target_username, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        guildId,
                        executorId,
                        target.id,
                        target.tag,
                        target.username,
                        reason,
                        duration,
                        timestamp,
                    ]
                );

                await interaction.reply({
                    content: `${target.tag} a été blacklisté.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error("Erreur lors de la blacklist :", err);
                await interaction.reply({
                    content: "Erreur lors de la procédure de blacklist de l'utilisateur.",
                    ephemeral: true,
                });
            }
        }
    },
};
