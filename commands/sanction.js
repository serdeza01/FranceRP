const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sanction")
        .setDescription("Commande de sanctions")
        .addSubcommand(subcommand =>
            subcommand
                .setName("eh")
                .setDescription("Afficher l'historique des sanctions d'un joueur")
                .addStringOption(option =>
                    option.setName("pseudo")
                        .setDescription("Le pseudo à rechercher")
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === "EH") {
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
                embed.addFields({
                    name: `Le ${new Date(sanction.created_at).toLocaleDateString()}`,
                    value: `**Sanctionné par :** <@${sanction.punisher_id}>\n**Raison :** ${sanction.raison}\n**Durée :** ${sanction.duration}\n**Serveur :** ${sanction.guild_id}`,
                    inline: false
                });
            });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
