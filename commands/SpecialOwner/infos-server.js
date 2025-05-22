const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("infos-server")
        .setDescription("Affiche les infos des serveurs du bot"),

    async execute(interaction) {
        if (interaction.user.id !== "637760775691173888") {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle("📊 Liste des serveurs")
            .setColor(0x3498db);

        interaction.client.guilds.cache.forEach(guild => {
            embed.addFields({
                name: guild.name,
                value: `🆔 \`${guild.id}\`\n👥 **${guild.memberCount}** membres\n📅 Ajouté le : <t:${Math.floor(guild.joinedTimestamp / 1000)}:F>`,
                inline: false
            });
        });

        interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
