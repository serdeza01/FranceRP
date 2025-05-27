const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

async function createPagination(interaction, pages, ephemeral = true) {
    let pageIndex = 0;

    const getMessagePayload = () => ({
        content: pages[pageIndex],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("prev")
                    .setLabel("◀️ Précédent")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId("next")
                    .setLabel("▶️ Suivant")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageIndex === pages.length - 1)
            )
        ]
    });

    await interaction.editReply({
        ...getMessagePayload(),
        ephemeral
    });

    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 120000
    });

    collector.on("collect", async i => {
        await i.deferUpdate();

        if (i.customId === "prev" && pageIndex > 0) {
            pageIndex--;
        } else if (i.customId === "next" && pageIndex < pages.length - 1) {
            pageIndex++;
        }

        await interaction.editReply(getMessagePayload());
    });

    collector.on("end", async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("prev")
                .setLabel("◀️ Précédent")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId("next")
                .setLabel("▶️ Suivant")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        await interaction.editReply({
            components: [disabledRow]
        }).catch(() => {});
    });
}

module.exports = { createPagination };