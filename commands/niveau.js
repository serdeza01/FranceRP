const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("niveau")
    .setDescription("Affiche ton niveau ou celui d'un autre utilisateur")
    .addUserOption(option =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur dont vous voulez voir le niveau")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    
    const guildId = interaction.guild.id;
    const user = interaction.options.getUser("utilisateur") || interaction.user;
    
    try {
      const [results] = await db.execute(
        "SELECT xp, level FROM user_levels WHERE guild_id = ? AND discord_id = ?",
        [guildId, user.id]
      );
      
      if (results.length === 0) {
        return interaction.editReply({ content: `<@${user.id}> n'a pas encore de niveau enregistré sur ce serveur.` });
      }
      
      const { xp, level } = results[0];
      const embed = new EmbedBuilder()
        .setTitle(`Niveau de ${user.username}`)
        .setDescription(`Niveau : **${level}**\nXP : **${xp}**`)
        .setColor("#00FFFF");
        
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Erreur lors de la récupération du niveau :", err);
      return interaction.editReply({ content: "Une erreur est survenue." });
    }
  },
};
