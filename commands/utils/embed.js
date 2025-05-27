const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Crée un embed personnalisé')
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('Titre de l’embed')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('description')
                .setDescription('Texte avec \\n pour les retours à la ligne, **gras**, _italique_, [liens](https://…)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('thumbnail')
                .setDescription('URL de la miniature')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('Hex couleur, ex: #ff00ff')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('footer')
                .setDescription('Texte du footer')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const title = interaction.options.getString('title');
        const rawDesc = interaction.options.getString('description');
        const thumbnail = interaction.options.getString('thumbnail');
        const color = interaction.options.getString('color') ?? '#0099ff';
        const footer = interaction.options.getString('footer');

        const description = rawDesc
            .replace(/\\n/g, '\n')
            .replace(/\\([*_~[\]()])/g, '$1');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);

        if (thumbnail) embed.setThumbnail(thumbnail);
        if (footer) embed.setFooter({ text: footer });

        await interaction.editReply({ embeds: [embed] });
    },
};
