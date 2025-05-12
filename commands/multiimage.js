const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multiimages')
        .setDescription('Embed avec plusieurs images en envois successifs')
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('Titre de l’embed')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('description')
                .setDescription('\\n pour saut de ligne, **gras**, _italique_…')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('images')
                .setDescription('Liste d’URLs d’images séparées par des espaces')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('Hex couleur, ex: #ff00ff')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const title = interaction.options.getString('title');
        const rawDesc = interaction.options.getString('description');
        const rawImages = interaction.options.getString('images') || '';
        const color = interaction.options.getString('color') ?? '#0099ff';

        const description = rawDesc
            .replace(/\\n/g, '\n')
            .replace(/\\([*_~[\]()])/g, '$1');

        const urls = rawImages.split(/\s+/).filter(u => u);

        const embeds = [];
        if (urls.length > 0) {
            const first = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setImage(urls[0]);
            embeds.push(first);
            for (let i = 1; i < urls.length; i++) {
                embeds.push(new EmbedBuilder().setImage(urls[i]).setColor(color));
            }
        } else {
            embeds.push(
                new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color)
            );
        }

        await interaction.editReply({ embeds });
    },
};
