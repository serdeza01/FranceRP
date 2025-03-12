const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Lier deux serveurs pour la commande sanctionEH")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName("guild_id")
                .setDescription("L'ID du serveur à lier avec le serveur actuel")
                .setRequired(true)
        ),
    async execute(interaction) {
        const guildId1 = interaction.guild.id;
        const guildId2 = interaction.options.getString("guild_id");

        if (guildId1 === guildId2) {
            return interaction.reply({ content: "❌ Vous ne pouvez pas lier le serveur avec lui-même.", ephemeral: true });
        }

        try {
            await db.execute(
                "INSERT IGNORE INTO linked_servers (guild_id1, guild_id2) VALUES (?, ?)",
                [guildId1, guildId2]
            );

            const [rows] = await db.execute(
                "SELECT guild_id1, guild_id2 FROM linked_servers WHERE (guild_id1 = ? AND guild_id2 = ?) OR (guild_id1 = ? AND guild_id2 = ?)",
                [guildId1, guildId2, guildId2, guildId1]
            );

            const embed = new EmbedBuilder()
                .setTitle("Serveurs liés")
                .setDescription(`Le serveur ${guildId1} est maintenant lié avec le serveur ${guildId2}`)
                .setColor(0x00ff00)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "❌ Une erreur est survenue lors du lien.", ephemeral: true });
        }
    }
};
