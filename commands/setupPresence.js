const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_presence')
        .setDescription('Configure le système de présence du staff')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Le salon où l\'embed de présence sera envoyé')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Le rôle du staff')
                .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        // Enregistrez ces paramètres dans votre base de données
        const query = `
      INSERT INTO presence_config (guild_id, channel_id, role_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), role_id = VALUES(role_id)
    `;
        await db.execute(query, [interaction.guild.id, channel.id, role.id]);

        await interaction.reply({
            content: `Le système de présence du staff a été configuré avec succès.\nSalon: ${channel.name}\nRôle: ${role.name}`,
            ephemeral: true,
        });
    },
};
