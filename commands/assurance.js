// assurance.js
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assurance')
    .setDescription("Affiche ta carte d'assurance"),
  
  async execute(interaction) {
    // Vous pouvez différer la réponse pour éviter l'expiration de l'interaction
    await interaction.deferReply({ ephemeral: false });
    
    const discordId = interaction.user.id;
    
    try {
      const [results] = await db.promise().execute(
        'SELECT * FROM assurance WHERE discord_id = ?',
        [discordId]
      );

      if (results.length === 0) {
        return interaction.editReply({ content: "Tu n'as pas d'assurance enregistrée." });
      }

      const assurance = results[0];
      const file = new AttachmentBuilder(assurance.image_path);
      const embed = new EmbedBuilder()
        .setTitle('🛡 Carte d’Assurance')
        .setColor('#ffcc00')
        .setImage(`attachment://${assurance.image_path.split('/').pop()}`)
        .setFooter({ text: `Expire le : ${assurance.date_expiration}` }); 

      return interaction.editReply({ embeds: [embed], files: [file] });

    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.editReply({ content: 'Erreur lors de la récupération des données.' });
    }
  }
};
