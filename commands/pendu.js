const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pendu")
    .setDescription("Joue au jeu du pendu"),
  async execute(interaction) {
    await interaction.reply("Commencez à deviner le mot lettre par lettre !");

    const words = [
      "abandon",
      "abeille",
      "abime",
      "abondance",
      "abricot",
      "absolu",
      "absence",
      "acajou",
      "acarien",
      "acide",
      "acier",
      "acte",
      "acteur",
      "actrice",
      "agence",
      "agent",
      "agrandissement",
      "agriculture",
      "aide",
      "aile",
      "air",
      "album",
      "alerte",
      "algue",
      "alliance",
      "allure",
      "amateur",
      "ambition",
      "ambre",
      "amour",
      "analyse",
      "anecdote",
      "ange",
      "animal",
      "animation",
      "anniversaire",
      "antenne",
      "antiquer",
      "antique",
      "anxiété",
      "ancre",
      "apaisement",
      "appareil",
      "appel",
      "applaudissement",
      "apprentissage",
      "arabesque",
      "arbre",
      "archaïque",
      "archer",
      "ardoise",
      "argument",
      "armature",
      "aromatique",
      "arrivée",
      "art",
      "article",
      "ascenseur",
      "aspect",
      "aspiration",
      "assiette",
      "astre",
      "atelier",
      "atmosphère",
      "atome",
      "attaque",
      "attente",
      "attitude",
      "attraction",
      "auberge",
      "audace",
      "aube",
      "auteur",
      "automne",
      "avalanche",
      "avenir",
      "avion",
      "avocat",
      "balade",
      "banane",
      "banc",
      "barbe",
      "baromètre",
      "base",
      "batterie",
      "beauté",
      "bibliothèque",
      "bijou",
      "blanc",
      "bleu",
      "boisson",
      "bonté",
      "bouche",
      "branche",
      "bureau",
      "cabine",
      "cactus",
      "cadence",
      "cahier",
      "calice",
      "calme",
      "camelote",
      "campagne",
      "canard",
      "capitale",
      "caravane",
      "cardinal",
      "cargo",
      "carte",
      "casque",
      "cathédrale",
      "caverne",
      "ceinture",
      "cendrier",
      "cerise",
      "chaleur",
      "chambre",
      "champion",
      "chance",
      "chanter",
      "charme",
      "chasse",
      "chat",
      "chef",
      "chemin",
      "chiffre",
      "choix",
      "cigare",
      "ciseaux",
      "citron",
      "clair",
      "cloche",
      "clown",
      "coal",
      "coeur",
      "coffre",
      "colline",
      "combat",
      "comédie",
      "compote",
      "concert",
      "confiance",
      "congé",
      "conseil",
      "contenu",
      "contraste",
      "conversation",
      "corps",
      "courage",
      "créativité"
    ];

    const word = words[Math.floor(Math.random() * words.length)].toLowerCase();
    let displayWord = word.replace(/./g, "_");
    let guessedLetters = [];
    let attempts = 8;

    const updateEmbed = () => {
      const embed = new EmbedBuilder()
        .setTitle("Jeu du Pendu")
        .setDescription(`Mot : ${displayWord.split("").join(" ")}`)
        .addFields(
          { name: "Lettres déjà proposées", value: guessedLetters.join(", ") || "Aucune" },
          { name: "Essais restants", value: attempts.toString() }
        );
      return embed;
    };

    const gameMessage = await interaction.followUp({ embeds: [updateEmbed()] });

    const filter = m => m.content.length === 1 && /^[a-zA-Z]$/.test(m.content);
    const collector = interaction.channel.createMessageCollector({ filter, time: 300000 });

    collector.on("collect", m => {
      const letter = m.content.toLowerCase();
      if (guessedLetters.includes(letter)) {
        m.reply("Lettre déjà proposée !");
        return;
      }
      guessedLetters.push(letter);
      if (word.includes(letter)) {
        let newDisplay = "";
        for (let i = 0; i < word.length; i++) {
          newDisplay += guessedLetters.includes(word[i]) ? word[i] : "_";
        }
        displayWord = newDisplay;
      } else {
        attempts--;
      }
      gameMessage.edit({ embeds: [updateEmbed()] });

      if (displayWord === word) {
        collector.stop("win");
        interaction.followUp(`Bravo ! Le mot était **${word}**.`);
      } else if (attempts <= 0) {
        collector.stop("lose");
        interaction.followUp(`Perdu ! Le mot était **${word}**.`);
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason !== "win" && reason !== "lose") {
        interaction.followUp(`Temps écoulé ! Le mot était **${word}**.`);
      }
    });
  },
};
