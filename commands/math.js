const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function generateProblem(factor) {
  const operators = ["+", "-", "*", "/"];
  const op = operators[Math.floor(Math.random() * operators.length)];
  let a, b, answer;

  switch (op) {
    case "+":
      a = Math.floor(Math.random() * factor) + 1;
      b = Math.floor(Math.random() * factor) + 1;
      answer = a + b;
      break;
    case "-":
      a = Math.floor(Math.random() * factor) + factor;
      b = Math.floor(Math.random() * factor) + 1;
      answer = a - b;
      break;
    case "*":
      a = Math.floor(Math.random() * Math.floor(Math.sqrt(factor * factor))) + 1;
      b = Math.floor(Math.random() * Math.floor(Math.sqrt(factor * factor))) + 1;
      answer = a * b;
      break;
    case "/":
      b = Math.floor(Math.random() * (factor - 1)) + 2;
      answer = Math.floor(Math.random() * factor) + 1;
      a = answer * b;
      break;
  }
  return { problem: `${a} ${op} ${b}`, answer };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("math")
    .setDescription("Fais des calculs mentaux pendant 2 minutes"),
  async execute(interaction) {
    await interaction.reply("Commence ton défi de calculs mentaux ! Tu as 2 minutes. Réponds correctement pour continuer.");

    let score = 0;
    let factor = 10;

    const generateAndAsk = async () => {
      const { problem, answer } = generateProblem(factor);
      const embed = new EmbedBuilder()
        .setTitle("Calcul Mental")
        .setDescription(`Résous : **${problem}**`);
      await interaction.followUp({ embeds: [embed] });
      return { answer };
    };

    let currentProblem = await generateAndAsk();

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000 });

    collector.on("collect", async m => {
      const userAnswer = parseFloat(m.content);
      if (userAnswer === currentProblem.answer) {
        score++;
        factor = Math.min(100, factor + 2);
        await interaction.followUp(`Correct ! Score: **${score}**`);
        currentProblem = await generateAndAsk();
      } else {
        collector.stop("wrong");
        const embed = new EmbedBuilder()
          .setTitle("Calcul Mental")
          .setDescription(`Mauvaise réponse ! Le jeu s'arrête. Score final : **${score}**`);
        interaction.followUp({ embeds: [embed] });
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction.followUp(`Le temps est écoulé ! Ton score final est **${score}**.`);
      }
    });
  },
};
