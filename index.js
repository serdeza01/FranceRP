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

const { sendTicketPanel } = require("./ticketPanel");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

global.staffStatus = new Map();
global.lastMessageId = null;
const STAFF_ROLE_ID = "1304151263851708458";
const CHANNEL_ID = "1337086501778882580";
const staffUsernames = [];

/**
 * Met à jour l'embed de présence dans le salon défini.
 * @param {Guild} guild Le serveur Discord
 * @param {string} channelId L'ID du salon où envoyer l'embed
 */
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

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("Le bot n'est dans aucun serveur.");
    return;
  }

  try {
    await guild.commands.set(client.commands.map((command) => command.data));
    console.log("Commandes enregistrées !");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes :", error);
  }

  try {
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

client.login(process.env.TOKEN);
