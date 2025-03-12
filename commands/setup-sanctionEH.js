const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup-sanctioneh")
        .setDescription("Configurer le système de sanctions EH")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Le salon où le bot lira les messages contenant les sanctions")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName("embed-channel")
                .setDescription("Le salon où envoyer l'embed de confirmation")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option.setName("role")
                .setDescription("Le rôle autorisé à utiliser la commande /sanction EH")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Vous devez être administrateur pour utiliser cette commande.",
                ephemeral: true
            });
        }

        const guildId = interaction.guild.id;
        const channel = interaction.options.getChannel("channel");
        const embedChannel = interaction.options.getChannel("embed-channel");
        const allowedRole = interaction.options.getRole("role");
        const query = `
        INSERT INTO sanction_config (guild_id, channel_id, embed_channel_id, allowed_role_id)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), embed_channel_id = VALUES(embed_channel_id), allowed_role_id = VALUES(allowed_role_id)
      `;

        try {
            await db.execute(query, [guildId, channel.id, embedChannel.id, allowedRole.id]);

            const embed = new EmbedBuilder()
                .setTitle("Configuration sanctionEH enregistrée !")
                .setDescription(`Salon de lecture: <#${channel.id}>
  Salon d'embed: <#${embedChannel.id}>
  Rôle autorisé: ${allowedRole.name}`)
                .setColor(0x00aaff)
                .setTimestamp();

            await embedChannel.send({ embeds: [embed] });
            await interaction.reply({
                content: "✅ La configuration sanctionEH a été mise à jour avec succès.",
                ephemeral: true
            });

            processSanctionHistory(interaction.guild, channel, embedChannel);
        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: "❌ Une erreur est survenue lors de la configuration.",
                ephemeral: true
            });
        }
    }
};

/**
 *
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {Guild} guild
 * @param {TextChannel} sanctionChannel
 * @param {TextChannel} embedChannel
 */
async function processSanctionHistory(guild, sanctionChannel, embedChannel) {
    try {
        let allMessages = [];
        let lastId = null;
        let fetchedMessages;

        do {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;
            fetchedMessages = await sanctionChannel.messages.fetch(options);
            const messagesArray = Array.from(fetchedMessages.values());
            allMessages = allMessages.concat(messagesArray);
            if (messagesArray.length > 0) {
                lastId = messagesArray[messagesArray.length - 1].id;
            }
            await sleep(250);
        } while (fetchedMessages.size === 100);

        const regex = /^Pseudo\s*:\s*(.+)\nRaison\s*:\s*(.+)\nSanction\s*:\s*(.+)$/i;
        let processedCount = 0;
        const { EmbedBuilder } = require("discord.js");

        for (const msg of allMessages) {
            const match = msg.content.match(regex);
            if (!match) continue;

            const pseudo = match[1].trim();
            const raison = match[2].trim();
            const sanctionRaw = match[3].trim();

            let duration;
            const durRegex = /^(\d+)([JMA])$/i;
            if (durRegex.test(sanctionRaw)) {
                const parts = sanctionRaw.match(durRegex);
                const nombre = parts[1];
                const uniteLetter = parts[2].toUpperCase();
                let unite;
                if (uniteLetter === "J") unite = "jour(s)";
                else if (uniteLetter === "M") unite = "mois";
                else if (uniteLetter === "A") unite = "an(s)";
                duration = `${nombre} ${unite}`;
            } else if (/^(perm|permanent)$/i.test(sanctionRaw)) {
                duration = "Permanent";
            } else {
                continue;
            }

            await db.execute(
                "INSERT INTO sanctions (guild_id, punisher_id, pseudo, raison, duration) VALUES (?, ?, ?, ?, ?)",
                [guild.id, msg.author.id, pseudo, raison, duration]
            );
            processedCount++;

            const embed = new EmbedBuilder()
                .setTitle("Sanction enregistrée")
                .addFields(
                    { name: "Pseudo", value: pseudo, inline: true },
                    { name: "Raison", value: raison, inline: true },
                    { name: "Durée", value: duration, inline: true },
                    { name: "Sanctionné par", value: `<@${msg.author.id}>`, inline: true }
                )
                .setColor(0xff0000)
                .setTimestamp();

            await embedChannel.send({ embeds: [embed] });
            await sleep(250);
        }

        const summaryEmbed = new EmbedBuilder()
            .setTitle("Traitement des anciens messages terminé")
            .setDescription(`Nombre de sanctions traitées : ${processedCount}`)
            .setColor(0x00aaff)
            .setTimestamp();

        await embedChannel.send({ embeds: [summaryEmbed] });
    } catch (error) {
        console.error("Erreur lors du traitement des anciens messages :", error);
    }
}