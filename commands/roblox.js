const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Affiche le compte Roblox associé à un utilisateur.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur Discord')
        .setRequired(true)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const discordId = user.id;

    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });

      const [rows] = await connection.execute("SELECT roblox_username FROM user_roblox WHERE discord_id = ?", [discordId]);
      await connection.end();

      if (rows.length > 0) {
        await interaction.reply({ content: `L'utilisateur **${user.tag}** est associé au compte Roblox : **${rows[0].roblox_username}**.` });
      } else {
        await interaction.reply({ content: `L'utilisateur **${user.tag}** n'a pas encore associé son compte Roblox.` });
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du compte Roblox :", error);
      await interaction.reply({ content: "Une erreur est survenue lors de la récupération de l'association.", ephemeral: true });
    }
  }
};
