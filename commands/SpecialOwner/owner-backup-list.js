const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("owner-backup-list")
        .setDescription("Statistiques globales et détaillées des sauvegardes")
        .addUserOption(opt =>
            opt.setName("user")
                .setDescription("Voir les sauvegardes et restaurations d'un utilisateur"))
        .addStringOption(opt =>
            opt.setName("server")
                .setDescription("ID du serveur pour voir ses sauvegardes/restaurations"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== "637760775691173888") {
            return interaction.reply({ content: "❌ Cette commande est réservée au propriétaire.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser("user");
        const serverId = interaction.options.getString("server");

        if (!targetUser && !serverId) {
            const [[{ total_backups }]] = await db.execute("SELECT COUNT(*) AS total_backups FROM backups");
            const [[{ total_restores }]] = await db.execute("SELECT COUNT(*) AS total_restores FROM backup_restores");

            const [byServer] = await db.execute(`
                SELECT guild_id, COUNT(*) AS count 
                FROM backups 
                GROUP BY guild_id 
                ORDER BY count DESC
            `);

            const embed = new EmbedBuilder()
                .setTitle("📦 Statistiques globales des sauvegardes")
                .addFields(
                    { name: "Total de sauvegardes", value: `${total_backups}`, inline: true },
                    { name: "Total de restaurations", value: `${total_restores}`, inline: true },
                    { name: "\u200B", value: "\u200B" }
                )
                .setColor("Blue")
                .setFooter({ text: "Utilise l'option user ou server pour plus de détails." });

            for (const entry of byServer.slice(0, 10)) {
                embed.addFields({ name: `Serveur ID ${entry.guild_id}`, value: `${entry.count} sauvegardes`, inline: false });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        let rows = [];
        let type = "";
        if (targetUser) {
            type = "user";
            const [userBackups] = await db.execute(`
                SELECT b.name, b.created_at, b.guild_id, u.username 
                FROM backups b
                LEFT JOIN users u ON u.user_id = b.user_id
                WHERE b.user_id = ?
                ORDER BY b.created_at DESC
            `, [targetUser.id]);

            const [restores] = await db.execute(`
                SELECT br.created_at, br.guild_id, br.user_id, b.name
                FROM backup_restores br
                LEFT JOIN backups b ON br.backup_id = b.id
                WHERE br.user_id = ?
                ORDER BY br.created_at DESC
            `, [targetUser.id]);

            rows.push(`📦 **Sauvegardes créées (${userBackups.length})**`);
            for (const entry of userBackups) {
                rows.push(`• \`${entry.name}\` sur \`${entry.guild_id}\` le ${new Date(entry.created_at).toLocaleString()}`);
            }

            rows.push(`\n♻️ **Restaurations effectuées (${restores.length})**`);
            for (const entry of restores) {
                rows.push(`• \`${entry.name}\` sur \`${entry.guild_id}\` le ${new Date(entry.created_at).toLocaleString()}`);
            }

        } else if (serverId) {
            type = "server";
            const [serverBackups] = await db.execute(`
                SELECT b.name, b.created_at, u.username, b.user_id 
                FROM backups b
                LEFT JOIN users u ON u.user_id = b.user_id
                WHERE b.guild_id = ?
                ORDER BY b.created_at DESC
            `, [serverId]);

            const [restores] = await db.execute(`
                SELECT br.created_at, br.user_id, b.name, u.username
                FROM backup_restores br
                LEFT JOIN backups b ON br.backup_id = b.id
                LEFT JOIN users u ON u.user_id = br.user_id
                WHERE br.guild_id = ?
                ORDER BY br.created_at DESC
            `, [serverId]);

            rows.push(`📦 **Sauvegardes sur ce serveur (${serverBackups.length})**`);
            for (const entry of serverBackups) {
                rows.push(`• \`${entry.name}\` par <@${entry.user_id}> le ${new Date(entry.created_at).toLocaleString()}`);
            }

            rows.push(`\n♻️ **Restaurations sur ce serveur (${restores.length})**`);
            for (const entry of restores) {
                rows.push(`• \`${entry.name}\` par <@${entry.user_id}> le ${new Date(entry.created_at).toLocaleString()}`);
            }
        }

        if (rows.length <= 25) {
            const embed = new EmbedBuilder()
                .setTitle(type === "user" ? `📊 Statistiques de ${targetUser.tag}` : `📊 Statistiques du serveur ${serverId}`)
                .setDescription(rows.join("\n"))
                .setColor("Green");

            return interaction.editReply({ embeds: [embed] });
        }

        let page = 0;
        const pageSize = 25;
        const totalPages = Math.ceil(rows.length / pageSize);

        const getPageEmbed = (index) => {
            const pageRows = rows.slice(index * pageSize, (index + 1) * pageSize);
            return new EmbedBuilder()
                .setTitle(type === "user" ? `📊 Statistiques de ${targetUser.tag}` : `📊 Statistiques du serveur ${serverId}`)
                .setDescription(pageRows.join("\n"))
                .setFooter({ text: `Page ${index + 1} / ${totalPages}` })
                .setColor("Green");
        };

        const backBtn = new ButtonBuilder().setCustomId("prev_page").setLabel("◀️").setStyle(ButtonStyle.Secondary);
        const nextBtn = new ButtonBuilder().setCustomId("next_page").setLabel("▶️").setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(backBtn, nextBtn);
        const msg = await interaction.editReply({ embeds: [getPageEmbed(page)], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on("collect", i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "Ce n'est pas ton menu.", ephemeral: true });

            if (i.customId === "prev_page" && page > 0) page--;
            if (i.customId === "next_page" && page < totalPages - 1) page++;

            i.update({ embeds: [getPageEmbed(page)], components: [row] });
        });

        collector.on("end", () => {
            msg.edit({ components: [] }).catch(() => { });
        });
    }
};
