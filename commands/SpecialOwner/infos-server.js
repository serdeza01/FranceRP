const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("infos-server")
        .setDescription("Affiche les infos des serveurs du bot"),

    async execute(interaction) {
        if (interaction.user.id !== "637760775691173888") {
            return interaction.reply({
                content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("📊 Liste des serveurs (triée par membres)")
            .setColor(0x3498db);

        const sortedGuilds = interaction.client.guilds.cache
            .sort((a, b) => b.memberCount - a.memberCount)
            .values();

        for (const guild of sortedGuilds) {
            let ownerTag = "Inconnu";

            try {
                const owner = await guild.fetchOwner();
                ownerTag = `${owner.user.tag}`;
            } catch (err) {
                console.warn(`Impossible d'obtenir l'owner pour ${guild.name}: ${err.message}`);
            }

            embed.addFields({
                name: guild.name,
                value:
                    `🆔 \`${guild.id}\`\n` +
                    `👑 Owner: ${ownerTag}\n` +
                    `👥 Membres: **${guild.memberCount}**\n` +
                    `📅 Ajouté le: <t:${Math.floor(guild.joinedTimestamp / 1000)}:F>`,
                inline: false
            });
        }

        interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
