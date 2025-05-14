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
                    opt
                        .setName("pseudo")
                        .setDescription("Le pseudo à rechercher")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("stats")
                .setDescription("Afficher le total des sanctions appliquées (ou d'un sanctionneur)")
                .addUserOption(opt =>
                    opt
                        .setName("utilisateur")
                        .setDescription("Le sanctionneur à cibler (optionnel)")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("leaderboard")
                .setDescription("Afficher le classement des sanctionneurs")
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        const [cfg] = await db.execute(
            "SELECT allowed_role_id FROM sanction_config WHERE guild_id = ?",
            [guildId]
        );
        if (!cfg.length)
            return interaction.reply({ content: "❌ Système non configuré.", ephemeral: true });
        const allowedRoleId = cfg[0].allowed_role_id;
        if (!interaction.member.roles.cache.has(allowedRoleId))
            return interaction.reply({ content: "❌ Rôle insuffisant.", ephemeral: true });

        let guildIds = [guildId];
        const [links] = await db.execute(
            "SELECT guild_id1, guild_id2 FROM linked_servers WHERE guild_id1 = ? OR guild_id2 = ?",
            [guildId, guildId]
        );
        for (const r of links) {
            if (r.guild_id1 !== guildId && !guildIds.includes(r.guild_id1)) guildIds.push(r.guild_id1);
            if (r.guild_id2 !== guildId && !guildIds.includes(r.guild_id2)) guildIds.push(r.guild_id2);
        }
        const placeholders = guildIds.map(() => "?").join(",");

        if (sub === "stats") {
            const userOpt = interaction.options.getUser("utilisateur");

            let sql = `
        SELECT
          SUM(CASE WHEN duration = 'Permanent' THEN 1 ELSE 0 END) AS permanent,
          SUM(CASE WHEN duration = 'Kick'      THEN 1 ELSE 0 END) AS kicks,
          SUM(CASE WHEN duration = '7 jour(s)'        THEN 1 ELSE 0 END) AS ban7,
          SUM(CASE WHEN duration = '2 jour(s)'        THEN 1 ELSE 0 END) AS ban2,
          COUNT(*)                                 AS total
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
                return interaction.reply({
                    content: `❌ <@${userOpt.id}> n'a pas encore appliqué de sanctions.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(userOpt ? " " : "🔴 Statistiques des sanctions")
                .setColor(0xFF0000)
                .setDescription([
                    userOpt ? `**Utilisateur :** <@${userOpt.id}>\n` : "",
                    `**Permanent**  : \`${t.permanent}\``,
                    `**Kick**       : \`${t.kicks}\``,
                    `**7 jours**    : \`${t.ban7}\``,
                    `**2 jours**    : \`${t.ban2}\``,
                    `**Total**      : \`${t.total}\``
                ].join("\n"))
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === "leaderboard") {
            const [rows] = await db.execute(
                `
        SELECT
          punisher_id,
          SUM(CASE WHEN duration = 'Permanent' THEN 1 ELSE 0 END) AS permanent,
          SUM(CASE WHEN duration = 'Kick'      THEN 1 ELSE 0 END) AS kicks,
          SUM(CASE WHEN duration = '7 jour(s)'        THEN 1 ELSE 0 END) AS ban7,
          SUM(CASE WHEN duration = '2 jour(s)'        THEN 1 ELSE 0 END) AS ban2,
          COUNT(*)                                 AS total
        FROM sanctions
        WHERE guild_id IN (${placeholders})
        GROUP BY punisher_id
        ORDER BY total DESC
        LIMIT 35
        `,
                guildIds
            );

            if (!rows.length) {
                return interaction.reply({
                    content: "❌ Aucune sanction n'a encore été appliquée.",
                    ephemeral: true
                });
            }

            const description = rows
                .map((r, i) =>
                    `**#${i + 1} • <@${r.punisher_id}>**\n` +
                    `> 🔴 \`Permanent\`   : ${r.permanent}   🟠 \`7 jours\` : ${r.ban7}   🟡 \`2 jours\` : ${r.ban2}   ⚫ \`Kick\` : ${r.kicks}\n` +
                    `> **Total** : \`${r.total}\``
                )
                .join("\n\n");

            const embed = new EmbedBuilder()
                .setTitle("Les staffs ayant mis le plus de sanctions")
                .setColor(0x00AAFF)
                .setDescription(description)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === "eh") {
            const pseudoRecherche = interaction.options.getString("pseudo");

            const [configRows] = await db.execute("SELECT allowed_role_id FROM sanction_config WHERE guild_id = ?", [guildId]);

            if (!configRows.length) {
                return interaction.reply({ content: "❌ Le système de sanctionEH n'est pas configuré sur ce serveur.", ephemeral: true });
            }

            const allowedRoleId = configRows[0].allowed_role_id;
            if (!interaction.member.roles.cache.has(allowedRoleId)) {
                return interaction.reply({ content: "❌ Vous n'avez pas le rôle requis pour effectuer cette commande.", ephemeral: true });
            }

            let guildIds = [guildId];
            const [linkedRows] = await db.execute("SELECT guild_id1, guild_id2 FROM linked_servers WHERE guild_id1 = ? OR guild_id2 = ?", [guildId, guildId]);
            for (const row of linkedRows) {
                if (row.guild_id1 !== guildId && !guildIds.includes(row.guild_id1)) guildIds.push(row.guild_id1);
                if (row.guild_id2 !== guildId && !guildIds.includes(row.guild_id2)) guildIds.push(row.guild_id2);
            }

            const [sanctions] = await db.execute(
                `SELECT guild_id, punisher_id, pseudo, raison, duration, created_at 
                 FROM sanctions 
                 WHERE pseudo = ? AND guild_id IN (${guildIds.map(() => '?').join(',')}) 
                 ORDER BY created_at DESC`,
                [pseudoRecherche, ...guildIds]
            );

            if (!sanctions.length) {
                return interaction.reply({ content: `❌ Aucune sanction trouvée pour **${pseudoRecherche}**.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Sanctions pour ${pseudoRecherche}`)
                .setColor(0xff0000)
                .setTimestamp();

            sanctions.forEach(sanction => {
                const date = new Date(sanction.created_at);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                const formattedDate = `${day}/${month}/${year}`;

                embed.addFields({
                    name: `Le ${formattedDate}`,
                    value: `**\nSanctionné par :** <@${sanction.punisher_id}>\n**Raison :** ${sanction.raison}\n**Durée :** ${sanction.duration}\n**Serveur :** ${sanction.guild_id}\n\n`,
                    inline: false
                });
            });

            return interaction.reply({ embeds: [embed], ephemeral: false });
        }
    }
};
