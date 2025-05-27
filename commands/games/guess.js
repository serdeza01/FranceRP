const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guess")
    .setDescription("Devinez le nombre mystère (entre 1 et 100)"),
  async execute(interaction) {
    await interaction.reply("Un nombre mystère a été choisi ! Essayez de le deviner dans les 3 minutes.");

    const target = Math.floor(Math.random() * 100) + 1;

    const filter = m => !m.author.bot && !isNaN(m.content);
    const collector = interaction.channel.createMessageCollector({ filter, time: 180000 });

    collector.on("collect", m => {
      const guess = parseInt(m.content, 10);
      
      if (guess === target) {
        collector.stop("win");
        const embed = new EmbedBuilder()
          .setTitle("Gagné !")
          .setDescription(`<@${m.author.id}> a deviné le bon nombre : **${target}**`);
        interaction.followUp({ embeds: [embed] });
      } else if (guess < target) {
        interaction.followUp(`<@${m.author.id}>, c'est plus !`);
      } else if (guess > target) {
        interaction.followUp(`<@${m.author.id}>, c'est moins !`);
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason !== "win") {
        interaction.followUp(`Temps écoulé ! Personne n'a trouvé le nombre. Le nombre mystère était **${target}**.`);
      }
    });
  },
};
