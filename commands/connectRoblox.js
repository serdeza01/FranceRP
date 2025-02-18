// connectRoblox.js
const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

function generateVerificationCode(length = 6) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connectroblox')
        .setDescription('Associe et vérifie ton compte Roblox.'),

    async execute(interaction) {
        // Crée un modal pour récupérer le nom d'utilisateur Roblox
        const modal = new ModalBuilder()
            .setCustomId('connectRobloxModal')
            .setTitle('Lien ton compte Roblox');

        // Création du champ pour le nom d'utilisateur Roblox
        const usernameInput = new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel("Nom d'utilisateur Roblox")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    },

    generateVerificationCode,
};
