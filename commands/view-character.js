const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");
const getLinkedGuildIds = require("../getLinkedGuildIds");

const ALLOWED_ROLES = [
    "1313029840328327248",
    "1304151263851708458",
    "962270129511604224",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("view-characters")
        .setDescription("Voir les personnages d'un utilisateur (tous les serveurs liés)")
        .setDefaultMemberPermissions(0)
        .setDMPermission(false)
        .addUserOption(o => o.setName("user").setDescription("Cible").setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id))) {
            return interaction.reply({ content: "❌ pas les bons rôles.", ephemeral: true });
        }

        const target = interaction.options.getUser("user") || interaction.user;
        const guildIds = await getLinkedGuildIds(db, interaction.guild.id);
        const ph = guildIds.map(() => "?").join(",");

        const [rows] = await db.execute(
            `SELECT slot, name, job1, job2
       FROM characters
       WHERE guild_id IN (${ph}) AND user_id = ?
       ORDER BY slot`,
            [...guildIds, target.id]
        );

        if (rows.length === 0) {
            return interaction.reply({ content: `❌ ${target.tag} n'a aucun personnage.`, ephemeral: true });
        }

        const map = new Map();
        for (const r of rows) {
            if (!map.has(r.slot)) map.set(r.slot, r);
        }

        const embed = new EmbedBuilder()
            .setTitle(`Personnages de ${target.tag}`)
            .setColor(0x00ae86)
            .setTimestamp();

        for (const [slot, r] of map) {
            embed.addFields({
                name: `Slot ${slot} : ${r.name}`,
                value: `Métier 1: ${r.job1 || "–"}\nMétier 2: ${r.job2 || "–"}`,
            });
        }

        return interaction.reply({ embeds: [embed] });
    },
};
