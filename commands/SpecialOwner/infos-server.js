const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

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
            const chunkIndex = Math.floor(i / 5);
            if (!acc[chunkIndex]) acc[chunkIndex] = [];
            acc[chunkIndex].push(guild);
            return acc;
        }, []);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Liste des serveurs (${i + 1}/${chunks.length})`)
                .setColor(0x3498db);

            for (const guild of chunks[i]) {
                let inviteLink = "❌ Impossible de créer une invitation";

                try {
                    const channel = guild.channels.cache.find(ch =>
                        ch.type === ChannelType.GuildText &&
                        ch.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreateInstantInvite)
                    );

                    if (channel) {
                        const invite = await channel.createInvite({
                            maxAge: 3600, // 1 heure
                            maxUses: 1,
                            unique: true,
                            reason: `Invitation générée via /infos-server par ${interaction.user.tag}`
                        });

                        inviteLink = `[🔗 Invitation](${invite.url})`;
                    }
                } catch (error) {
                    console.warn(`Erreur lors de la création d'une invitation pour ${guild.name} :`, error.message);
                }

                embed.addFields({
                    name: `${guild.name} (${guild.memberCount} membres)`,
                    value: `🆔 \`${guild.id}\`\n👑 Owner : <@${guild.ownerId}>\n📅 <t:${Math.floor(guild.joinedTimestamp / 1000)}:F>\n${inviteLink}`,
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
