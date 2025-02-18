const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifyroblox')
        .setDescription('Vérifie que ton compte Roblox contient le code de vérification.'),

    async execute(interaction) {
        const discordId = interaction.user.id;

        try {
            const querySelect = `SELECT roblox_username, verification_code, verified FROM user_roblox WHERE discord_id = ?`;
            const [rows] = await db.execute(querySelect, [discordId]);

            if (!rows || rows.length === 0) {
                return interaction.reply({ content: "Aucune association trouvée. Utilise `/connectroblox` d'abord.", ephemeral: true });
            }
            const { roblox_username, verification_code, verified } = rows[0];

            if (verified) {
                return interaction.reply({ content: "Ton compte Roblox a déjà été vérifié.", ephemeral: true });
            }

            const resUser = await fetch(`https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(roblox_username)}`);
            const userData = await resUser.json();

            if (!userData || userData.success === false) {
                return interaction.reply({ content: "Impossible de trouver ce compte Roblox.", ephemeral: true });
            }
            const robloxId = userData.Id;

            // (L'endpoint dépend de l'API, voici un exemple générique)
            const resProfile = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
            const profileData = await resProfile.json();

            const bio = profileData.description || '';

            if (bio.includes(verification_code)) {
                const queryUpdate = `UPDATE user_roblox SET verified = 1 WHERE discord_id = ?`;
                await db.execute(queryUpdate, [discordId]);

                await interaction.reply({ content: "Ton compte Roblox a été vérifié avec succès !", ephemeral: true });
            } else {
                await interaction.reply({ content: "Le code de vérification n'a pas été trouvé dans ton profil Roblox. Vérifie que tu l'as bien ajouté.", ephemeral: true });
            }
        } catch (error) {
            console.error("Erreur lors de la vérification du compte Roblox :", error);
            await interaction.reply({ content: "Une erreur est survenue lors de la vérification de ton compte.", ephemeral: true });
        }
    },
};
