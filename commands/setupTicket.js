const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_ticket')
        .setDescription('Configure le système de tickets avec des options personnalisées')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Le salon où les tickets apparaîtront')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('La catégorie où les tickets seront créés')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Le rôle qui a accès aux tickets')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('transcript_channel')
                .setDescription('Le salon où les transcripts seront envoyés')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('panel_message')
                .setDescription('Le message affiché dans le canal pour ouvrir un ticket')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('button_count')
                .setDescription('Le nombre de boutons pour les tickets')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('button_names')
                .setDescription('Les noms des boutons, séparés par des virgules')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ticket_messages')
                .setDescription('Les messages envoyés lors de l\'ouverture des tickets, séparés par des virgules')
                .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category');
        const role = interaction.options.getRole('role');
        const transcriptChannel = interaction.options.getChannel('transcript_channel');
        const panelMessage = interaction.options.getString('panel_message');
        const buttonCount = interaction.options.getInteger('button_count');
        const buttonNames = interaction.options.getString('button_names').split(',');
        const ticketMessages = interaction.options.getString('ticket_messages').split(',');

        // Vérification des paramètres
        if (buttonNames.length !== buttonCount || ticketMessages.length !== buttonCount) {
            return interaction.reply({
                content: 'Le nombre de noms de boutons et de messages de ticket doit correspondre au nombre de boutons.',
                ephemeral: true,
            });
        }

        const query = `
      INSERT INTO ticket_config (guild_id, channel_id, category_id, role_id, transcript_channel_id, panel_message, button_names, ticket_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        channel_id = VALUES(channel_id), 
        category_id = VALUES(category_id), 
        role_id = VALUES(role_id),
        transcript_channel_id = VALUES(transcript_channel_id),
        panel_message = VALUES(panel_message),
        button_names = VALUES(button_names),
        ticket_messages = VALUES(ticket_messages)
    `;
        await db.execute(query, [
            interaction.guild.id,
            channel.id,
            category.id,
            role.id,
            transcriptChannel.id,
            panelMessage,
            JSON.stringify(buttonNames),
            JSON.stringify(ticketMessages),
        ]);

        await interaction.reply({
            content: `Le système de tickets a été configuré avec succès.\nSalon: ${channel.name}\nCatégorie: ${category.name}\nRôle: ${role.name}\nSalon de transcript: ${transcriptChannel.name}`,
            ephemeral: true,
        });

        await sendTicketPanel(client);
    },
};
