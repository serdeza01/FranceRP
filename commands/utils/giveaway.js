const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Lance un giveaway")
        .addIntegerOption(option =>
            option
                .setName("duree")
                .setDescription("Durée du giveaway (en jours)")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("gagnants")
                .setDescription("Nombre de gagnants")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("titre")
                .setDescription("Titre de l'embed du giveaway")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("description")
                .setDescription("Description de l'embed du giveaway")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true
            });
        }

        const durationDays = interaction.options.getInteger("duree");
        const numberOfWinners = interaction.options.getInteger("gagnants");
        const title = interaction.options.getString("titre");
        const description = interaction.options.getString("description");

        const durationMs = durationDays * 24 * 60 * 60 * 1000;
        const endDate = new Date(Date.now() + durationMs);

        const giveawayEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: `Fin dans ${durationDays} jour(s) | ${numberOfWinners} gagnant(s)` })
            .setTimestamp(endDate);

        const joinButton = new ButtonBuilder()
            .setCustomId("giveaway_join")
            .setLabel("Rejoindre")
            .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder().addComponents(joinButton);

        const giveawayMessage = await interaction.reply({
            embeds: [giveawayEmbed],
            components: [actionRow],
            fetchReply: true
        });

        await db.execute(
            "INSERT INTO giveaways (message_id, channel_id, guild_id, end_date, winners_count, participants, ended) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                giveawayMessage.id,
                giveawayMessage.channel.id,
                interaction.guild.id,
                endDate,
                numberOfWinners,
                JSON.stringify([]),
                false
            ]
        );

        const filter = i => i.customId === "giveaway_join" && !i.user.bot;
        const collector = giveawayMessage.createMessageComponentCollector({ filter, time: durationMs });

        collector.on("collect", async buttonInteraction => {
            const userId = buttonInteraction.user.id;

            const [rows] = await db.execute(
                "SELECT * FROM giveaways WHERE message_id = ?",
                [giveawayMessage.id]
            );

            if (!rows.length) return;

            const currentGiveaway = rows[0];
            let participants = JSON.parse(currentGiveaway.participants);

            if (participants.includes(userId)) {
                return buttonInteraction.reply({
                    content: "Vous avez déjà rejoint ce giveaway !",
                    ephemeral: true
                });
            }

            participants.push(userId);

            await db.execute(
                "UPDATE giveaways SET participants = ? WHERE message_id = ?",
                [JSON.stringify(participants), giveawayMessage.id]
            );

            await buttonInteraction.reply({
                content: "Vous avez rejoint le giveaway !",
                ephemeral: true
            });
        });

        collector.on("end", async () => {
            joinButton.setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(joinButton);
            await giveawayMessage.edit({ components: [disabledRow] });

            const [rows] = await db.execute(
                "SELECT * FROM giveaways WHERE message_id = ?",
                [giveawayMessage.id]
            );

            if (!rows.length) return;
            const finalGiveaway = rows[0];
            const participants = JSON.parse(finalGiveaway.participants);

            if (participants.length === 0) {
                return interaction.followUp("Aucun participant n'a rejoint le giveaway.");
            }

            const shuffled = participants.sort(() => Math.random() - 0.5);
            const winners = shuffled.slice(0, numberOfWinners);

            const resultEmbed = new EmbedBuilder()
                .setTitle("Giveaway terminé !")
                .setDescription(
                    `Félicitations ${winners.map(id => `<@${id}>`).join(", ")}\nVous avez gagné !`
                )
                .setTimestamp();

            await interaction.followUp({ embeds: [resultEmbed] });

            await db.execute(
                "UPDATE giveaways SET ended = ?, winners = ? WHERE message_id = ?",
                [true, JSON.stringify(winners), giveawayMessage.id]
            );
        });
    }
};
