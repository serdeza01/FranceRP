const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sanction")
        .setDescription("Commande de sanctions")
        .addSubcommand(sub =>
            sub
                .setName("eh")
                .setDescription("Afficher l'historique des sanctions d'un joueur")
                .addStringOption(opt =>
                    opt.setName("pseudo")
                        .setDescription("Le pseudo à rechercher")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("stats")
                .setDescription("Afficher le total des sanctions appliquées (ou d'un staff)")
                .addUserOption(opt =>
                    opt.setName("utilisateur")
                        .setDescription("Le staff choisi (optionnel)")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("leaderboard")
                .setDescription("Afficher le leaderboard des staffs")
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        const SUPER_MOD_ROLES = [
            "1313029840328327248",
            "1304151263851708458"
        ];
        const isSuperMod = SUPER_MOD_ROLES.some(rid =>
            interaction.member.roles.cache.has(rid)
        );

        const [[config]] = await db.execute(
            "SELECT allowed_role_id FROM sanction_config WHERE guild_id = ?",
            [guildId]
        );

        if (!config && !isSuperMod) {
            return interaction.reply({ content: "❌ Système non configuré.", ephemeral: true });
        }

        let allowedRoleId = null;
        if (config && config.allowed_role_id != null) {
            allowedRoleId = String(config.allowed_role_id);
        }
        if (!isSuperMod && (!allowedRoleId || !interaction.member.roles.cache.has(allowedRoleId))) {
            return interaction.reply({ content: "❌ Rôle insuffisant.", ephemeral: true });
        }

        const guildIds = [guildId];
        const [links] = await db.execute(
            "SELECT guild_id1, guild_id2 FROM linked_servers WHERE guild_id1 = ? OR guild_id2 = ?",
            [guildId, guildId]
        );
        for (const r of links) {
            if (r.guild_id1 !== guildId && !guildIds.includes(r.guild_id1)) guildIds.push(r.guild_id1);
            if (r.guild_id2 !== guildId && !guildIds.includes(r.guild_id2)) guildIds.push(r.guild_id2);
        }
        const placeholders = guildIds.map(() => "?").join(",");

        const sub = interaction.options.getSubcommand();

        if (sub === "stats") {
            const userOpt = interaction.options.getUser("utilisateur");
            let sql = `
        SELECT
          SUM(duration = 'Permanent')    AS permanent,
          SUM(duration = 'Kick')         AS kicks,
          SUM(duration = '7 jour(s)')    AS ban7,
          SUM(duration = '2 jour(s)')    AS ban2,
          COUNT(*)                       AS total
        FROM sanctions
        WHERE guild_id IN (${placeholders})
      `;
            const params = [...guildIds];
            if (userOpt) {
                sql += " AND punisher_id = ?";
                params.push(userOpt.id);
            }
            const [[t]] = await db.execute(sql, params);
            if (userOpt && t.total === 0) {
                return interaction.reply({ content: `❌ <@${userOpt.id}> n'a pas encore appliqué de sanctions.`, ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle(userOpt ? `Stats de ${userOpt.tag}` : "🔴 Statistiques des sanctions")
                .setColor(0xFF0000)
                .setDescription([
                    userOpt ? `**Utilisateur :** <@${userOpt.id}>\n` : "",
                    `**Permanent** : \`${t.permanent}\``,
                    `**Kick**      : \`${t.kicks}\``,
                    `**7 jours**   : \`${t.ban7}\``,
                    `**2 jours**   : \`${t.ban2}\``,
                    `**Total**     : \`${t.total}\``
                ].join("\n"));
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === "leaderboard") {
            const [[...rows]] = await db.execute(
                `SELECT punisher_id,
                SUM(duration = 'Permanent') AS permanent,
                SUM(duration = 'Kick')      AS kicks,
                SUM(duration = '7 jour(s)') AS ban7,
                SUM(duration = '2 jour(s)') AS ban2,
                COUNT(*)                    AS total
           FROM sanctions
          WHERE guild_id IN (${placeholders})
       GROUP BY punisher_id
       ORDER BY total DESC
          LIMIT 15`,
                guildIds
            );
            if (!rows.length) {
                return interaction.reply({ content: "❌ Pas encore de sanctions.", ephemeral: true });
            }
            const description = rows
                .map((r, i) =>
                    `**#${i + 1} • <@${r.punisher_id}>**\n` +
                    `> 🔴 \`Permanent\`: ${r.permanent}  🟠 \`7 jours\`: ${r.ban7}  🟡 \`2 jours\`: ${r.ban2}  ⚫ \`Kick\`: ${r.kicks}\n` +
                    `> **Total**: \`${r.total}\``
                )
                .join("\n\n");
            const embed = new EmbedBuilder()
                .setTitle("🏆 Leaderboard des sanctions")
                .setColor(0x00AAFF)
                .setDescription(description)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === "eh") {
            const pseudo = interaction.options.getString("pseudo");
            const [sanctions] = await db.execute(
                `SELECT guild_id, punisher_id, raison, duration, created_at
           FROM sanctions
          WHERE pseudo = ? AND guild_id IN (${placeholders})
          ORDER BY created_at DESC
          LIMIT 25`,
                [pseudo, ...guildIds]
            );
            if (!sanctions.length) {
                return interaction.reply({ content: `❌ Aucune sanction trouvée pour **${pseudo}**.`, ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle(`Sanctions pour ${pseudo}`)
                .setColor(0xFF0000)
                .setTimestamp();
            for (const s of sanctions) {
                const d = new Date(s.created_at);
                const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                embed.addFields({
                    name: date,
                    value:
                        `**Sanctionné par :** <@${s.punisher_id}>\n` +
                        `**Raison**       : ${s.raison}\n` +
                        `**Durée**        : ${s.duration}\n` +
                        `**Serveur**      : ${s.guild_id}`
                });
            }
            return interaction.reply({ embeds: [embed] });
        }
    }
};
