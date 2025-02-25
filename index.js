const {
  Client,
  GatewayIntentBits,
  Collection,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const db = require("./db");
global.database = db;

const { sendTicketPanel } = require("./ticketPanel");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// Variables globales
client.commands = new Collection();
global.staffStatus = new Map();
global.lastMessageId = null;
global.reactionChannels = new Set();

// Fonction d'initialisation de la base de données
async function initDatabase() {
  try {
    // Création de la table si elle n'existe pas
    await db.promise().execute(`
      CREATE TABLE IF NOT EXISTS reaction_channels (
        channel_id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL
      )
    `);

    // Chargement des salons configurés depuis la table
    const [rows] = await db.promise().execute('SELECT channel_id FROM reaction_channels');
    rows.forEach(ch => global.reactionChannels.add(ch.channel_id));
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la DB:", error);
  }
}

// Chargement des commandes
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const STAFF_ROLE_ID = "1304151263851708458";
const CHANNEL_ID = "1337086501778882580";
const staffUsernames = [];

// Fonction existante inchangée
async function updatePresenceEmbed(guild, channelId) {
  try {
    const availableStaff = [];
    const channel = await client.channels.fetch(channelId);
    for (const [userId, status] of global.staffStatus) {
      if (status === "disponible") {
        try {
          const member = await client.users.fetch(userId);
          const guildMember = await guild.members.fetch(member.id);
          availableStaff.push(`- ${guildMember.displayName}`);
        } catch (error) {
          console.warn(`Impossible de récupérer le membre ${userId}`);
        }
      }
    }
    const file = new AttachmentBuilder("./image.png");
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Statut des Staffs disponibles en jeu")
      .setTimestamp()
      .setThumbnail("attachment://image.png")
      .addFields({
        name: "Disponibles",
        value: availableStaff.join("\n") || "Aucun",
        inline: false,
      });
    if (global.lastMessageId) {
      const lastMessage = await channel.messages
        .fetch(global.lastMessageId)
        .catch(() => null);
      if (lastMessage) await lastMessage.delete();
    }

    const newMessage = await channel.send({ embeds: [embed], files: [file] });
    global.lastMessageId = newMessage.id;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'embed :", error);
  }
}

client.once("ready", async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  try {
    await client.application.commands.set(client.commands.map((command) => command.data));
    console.log("Commandes enregistrées globalement !");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes globales :", error);
  }

  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log("Le bot n'est dans aucun serveur.");
      return;
    }
    const members = await guild.members.fetch();
    for (const username of staffUsernames) {
      const member = members.find((m) => m.user.username === username);
      if (member && member.roles.cache.has(STAFF_ROLE_ID)) {
        global.staffStatus.set(member.id, "disponible");
      }
    }
    await updatePresenceEmbed(guild, CHANNEL_ID);
  } catch (error) {
    console.error("Erreur lors de la récupération des membres :", error);
  }
  await sendTicketPanel(client);
});

// Gestion des messages avec réactions
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  
  if (global.reactionChannels.has(message.channel.id)) {
    try {
      await message.react('✅');
      await message.react('❌');
    } catch (error) {
      console.error(`Erreur de réaction dans ${message.channel.id}:`, error);
    }
  }
});

// Nettoyage des salons supprimés
client.on("channelDelete", async channel => {
  if (global.reactionChannels.has(channel.id)) {
    try {
      await db.promise().execute('DELETE FROM reaction_channels WHERE channel_id = ?', [channel.id]);
      global.reactionChannels.delete(channel.id);
    } catch (error) {
      console.error("Erreur lors de la suppression du salon dans la DB:", error);
    }
  }
});

// Gestion des interactions existante
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, {
        staffStatus: global.staffStatus,
        updatePresenceEmbed,
        CHANNEL_ID,
        STAFF_ROLE_ID,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Une erreur est survenue.",
        ephemeral: true,
      });
    }
  } else if (interaction.isButton()) {
    const buttonHandler = require("./interactionCreate");
    buttonHandler(interaction);
  }
});

// Initialisation de la base de données puis connexion du client
(async () => {
  await initDatabase();
  client.login(process.env.TOKEN);
})();
