const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("commands-use")
        .setDescription("Affiche les stats d'utilisation des commandes par serveur"),

    async execute(interaction) {
        if (interaction.user.id !== "637760775691173888") {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        const [[totals]] = await db.execute(`
            SELECT command_name, COUNT(*) as count
            FROM commands_logs
            WHERE used_at >= NOW() - INTERVAL 7 DAY
            GROUP BY command_name
            ORDER BY count DESC
            LIMIT 1
        `);

        const [perGuild] = await db.execute(`
            SELECT guild_id, command_name, COUNT(*) as count
            FROM commands_logs
            WHERE used_at >= NOW() - INTERVAL 7 DAY
            GROUP BY guild_id, command_name
        `);

        const embed = new EmbedBuilder()
            .setTitle("📈 Commandes les plus utilisées")
            .setColor(0x2ecc71)
            .addFields({ name: "Commandes TOP (global)", value: `**${totals.command_name}** - \`${totals.count}\` fois` });

        const guildMap = new Map();
        for (const row of perGuild) {
            const current = guildMap.get(row.guild_id);
            if (!current || row.count > current.count) {
                guildMap.set(row.guild_id, { name: row.command_name, count: row.count });
            }
        }

        for (const [guildId, data] of guildMap.entries()) {
            const guild = interaction.client.guilds.cache.get(guildId);
            const guildName = guild ? guild.name : "Serveur inconnu";

            embed.addFields({
                name: guildName,
                value: `📌 **${data.name}** - \`${data.count}\` fois\n🆔 \`${guildId}\``,
                inline: false
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
