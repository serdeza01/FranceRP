const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Affiche le compte Roblox associé à un utilisateur Discord ou à un nom Roblox.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription("L'utilisateur Discord")
        .setRequired(false)
    )
    .addStringOption(option => 
      option.setName('username')
        .setDescription("Le nom d'utilisateur Roblox")
        .setRequired(false)
    ),
  async execute(interaction) {
    const discordUser = interaction.options.getUser('user');
    const robloxUsername = interaction.options.getString('username');

    if (!discordUser && !robloxUsername) {
      return interaction.reply({
        content: "Veuillez spécifier soit un utilisateur Discord, soit un nom d'utilisateur Roblox.",
        ephemeral: true,
      });
    }

    try {
      let query;
      let params;

      if (discordUser) {
        query = "SELECT roblox_username FROM user_roblox WHERE discord_id = ?";
        params = [discordUser.id];
      } else {
        query = "SELECT discord_id FROM user_roblox WHERE roblox_username = ?";
        params = [robloxUsername];
      }

      const [rows] = await db.execute(query, params);
      
      if (rows.length > 0) {
        if (discordUser) {
          return interaction.reply({
            content: `L'utilisateur **${discordUser.tag}** est associé au compte Roblox : **${rows[0].roblox_username}**.`,
          });
        } else {
          const discordId = rows[0].discord_id;
          const fetchedUser = await interaction.client.users.fetch(discordId);
          return interaction.reply({
            content: `Le compte Roblox **${robloxUsername}** est associé à l'utilisateur Discord : **${fetchedUser.tag}**.`,
          });
        }
      } else {
        if (discordUser) {
          return interaction.reply({
            content: `L'utilisateur **${discordUser.tag}** n'a pas associé de compte Roblox.`,
          });
        } else {
          return interaction.reply({
            content: `Aucune association trouvée pour le compte Roblox **${robloxUsername}**.`,
          });
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de l'association Roblox :", error);
      return interaction.reply({
        content: "Une erreur est survenue lors de la récupération de l'association.",
        ephemeral: true,
      });
    }
  }
};
