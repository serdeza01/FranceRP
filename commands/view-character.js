const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("view-characters")
        .setDescription("Voir les personnages d'un utilisateur")
        .addUserOption(opt =>
            opt
                .setName("user")
                .setDescription("Utilisateur cible (par défaut vous-même)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const ALLOWED_ROLES = [
            "1313029840328327248",
            "1304151263851708458",
            "962270129511604224",
        ];

        if (
            !interaction.member.roles.cache.some((r) =>
                ALLOWED_ROLES.includes(r.id)
            )
        ) {
            return interaction.reply({
                content: "❌ Vous n’avez pas la permission d’utiliser cette commande.",
                ephemeral: true,
            });
        }
        const guildId = interaction.guild.id;
        const user = interaction.options.getUser("user") ?? interaction.user;

        try {
            const [rows] = await db.execute(
                "SELECT slot, name, job1, job2 FROM characters WHERE guild_id = ? AND user_id = ? ORDER BY slot",
                [guildId, user.id]
            );

            if (rows.length === 0) {
                return interaction.reply({
                    content: `❌ ${user.tag} n'a aucun personnage enregistré.`,
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Personnages de ${user.tag}`)
                .setColor(0x00ae86)
                .setTimestamp();

            for (const r of rows) {
                embed.addFields({
                    name: `Personnage ${r.slot}: ${r.name}`,
                    value: `Métier 1: ${r.job1 || "–"}\nMétier 2: ${r.job2 || "–"}`,
                    inline: false,
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: false });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "❌ Impossible de récupérer les données.", ephemeral: true });
        }
    },
};
