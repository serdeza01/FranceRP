const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

const GRID_SIZE = 10;

function generateGrid(snake, apple) {
  let grid = "";
  for (let y = 0; y < GRID_SIZE; y++) {
    let row = "";
    for (let x = 0; x < GRID_SIZE; x++) {
      if (snake.some(segment => segment.x === x && segment.y === y)) {
        row += "🟩";
      } else if (apple.x === x && apple.y === y) {
        row += "🍎";
      } else {
        row += "⬜";
      }
    }
    grid += row + "\n";
  }
  return grid;
}

function getRandomApple(snake) {
  let position;
  do {
    position = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
  } while (snake.some(segment => segment.x === position.x && segment.y === position.y));
  return position;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snake")
    .setDescription("Joue au jeu du Snake"),
  async execute(interaction) {
    await interaction.deferReply();

    let snake = [{ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }];
    let direction = { x: 1, y: 0 };
    let apple = getRandomApple(snake);

    const embed = new EmbedBuilder()
      .setTitle("Snake Game")
      .setDescription(generateGrid(snake, apple))
      .setFooter({ text: "Utilisez les boutons pour déplacer le serpent" });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("up").setLabel("⬆️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("down").setLabel("⬇️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("left").setLabel("⬅️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("right").setLabel("➡️").setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.editReply({ embeds: [embed], components: [buttons] });

    const collector = message.createMessageComponentCollector({ 
      filter: i => i.user.id === interaction.user.id,
      componentType: ComponentType.Button, 
      time: 1800000 // 30 minutes
    });

    collector.on("collect", async i => {
      const newDir = { x: 0, y: 0 };
      if (i.customId === "up") newDir.y = -1;
      if (i.customId === "down") newDir.y = 1;
      if (i.customId === "left") newDir.x = -1;
      if (i.customId === "right") newDir.x = 1;

      if (snake.length > 1 && (snake[0].x + newDir.x === snake[1].x && snake[0].y + newDir.y === snake[1].y)) {
        await i.reply({ content: "Vous ne pouvez pas revenir en arrière.", ephemeral: true });
        return;
      }
      direction = newDir;

      const newHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        collector.stop("gameover");
        return i.update({ content: "Game Over : Le serpent est sorti de la grille.", components: [] });
      }
      if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        collector.stop("gameover");
        return i.update({ content: "Game Over : Le serpent s'est mordu lui-même.", components: [] });
      }
      snake.unshift(newHead);

      if (newHead.x === apple.x && newHead.y === apple.y) {
        apple = getRandomApple(snake);
      } else {
        snake.pop();
      }

      const newEmbed = new EmbedBuilder()
        .setTitle("Snake Game")
        .setDescription(generateGrid(snake, apple))
        .setFooter({ text: "Utilisez les boutons pour déplacer le serpent" });
      await i.update({ embeds: [newEmbed] });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] });
    });
  },
};
