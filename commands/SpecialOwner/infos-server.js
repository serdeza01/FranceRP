const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("infos-server")
        .setDescription("Affiche les infos des serveurs du bot"),

    async execute(interaction) {
        if (interaction.user.id !== "637760775691173888") {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guilds = interaction.client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount);
        const embeds = [];

        const chunks = [...guilds.values()].reduce((acc, guild, i) => {
            const chunkIndex = Math.floor(i / 25);
            if (!acc[chunkIndex]) acc[chunkIndex] = [];
            acc[chunkIndex].push(guild);
            return acc;
        }, []);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Liste des serveurs (${i + 1}/${chunks.length})`)
                .setColor(0x3498db);

            for (const guild of chunks[i]) {
                embed.addFields({
                    name: `${guild.name} (${guild.memberCount} membres)`,
                    value: `🆔 \`${guild.id}\`\n👑 Owner : <@${guild.ownerId}>\n📅 <t:${Math.floor(guild.joinedTimestamp / 1000)}:F>`,
                    inline: false
                });
            }

            if (i === 0) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
