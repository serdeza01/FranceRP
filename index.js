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
const Database = require("better-sqlite3");
const axios = require("axios");

const {
  updatePresenceEmbed,
  buildPresenceEmbed,
} = require("./commands/presence");

// Initialisation de la base de données
const db = new Database("database.db");
global.database = db; // Export global

// Création des tables si inexistantes
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS presence_embed (
    channel_id TEXT PRIMARY KEY,
    message_id TEXT
  )`
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS user_roblox (
    discord_id TEXT PRIMARY KEY,
    roblox_username TEXT,
    roblox_id TEXT
  )`
).run();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

process.on("uncaughtException", (err) => {
  console.error("Erreur non gérée :", err);
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (!command.data || !command.data.name) {
    console.warn(
      `Le fichier ${file} ne possède pas de propriété data.name. Commande ignorée.`
    );
    continue;
  }
  client.commands.set(command.data.name, command);
}

global.staffStatus = new Map();
global.lastMessageId = null;
global.ticketAuthorizedRoles = new Set();
global.ticketAuthorizedUsers = new Set();
global.reactionChannels = new Set();

const STAFF_ROLE_ID = "1304151263851708458";
const CHANNEL_ID = "1337086501778882580";
const staffUsernames = [];

async function updatePresenceEmbedMessage(guild, channelId) {
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

    let sentMessage;
    if (global.lastMessageId) {
      sentMessage = await channel.messages
        .fetch(global.lastMessageId)
        .catch(() => null);
      if (sentMessage) {
        await sentMessage.edit({ embeds: [embed], files: [file] });
      }
    }

    if (!global.lastMessageId || !sentMessage) {
      const newMessage = await channel.send({ embeds: [embed], files: [file] });
      global.lastMessageId = newMessage.id;

      const stmt = db.prepare(`
        INSERT INTO presence_embed (channel_id, message_id) 
        VALUES (?, ?) 
        ON CONFLICT(channel_id) 
        DO UPDATE SET message_id = excluded.message_id
      `);
      stmt.run(channelId, newMessage.id);
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'embed :", error);
  }
}

async function updateTicketEmbed(guild, channelId) {
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) {
      console.error("Salon de ticket introuvable pour updateTicketEmbed.");
      return;
    }
    await sendTicketPanel(client);
  } catch (error) {
    console.error("Erreur dans updateTicketEmbed :", error);
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
    const row = db
      .prepare(
        `
      SELECT message_id 
      FROM presence_embed 
      WHERE channel_id = ?
    `
      )
      .get(CHANNEL_ID);

    if (row && row.message_id) {
      global.lastMessageId = row.message_id;
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de l'embed de présence en BDD :",
      error
    );
  }

  try {
    const members = await guild.members.fetch();
    for (const username of staffUsernames) {
      const member = members.find((m) => m.user.username === username);
      if (member && member.roles.cache.has(STAFF_ROLE_ID)) {
        global.staffStatus.set(member.id, "disponible");
      }
    }

    const channel = await guild.channels.fetch(CHANNEL_ID);
    let presenceMessage;
    if (!global.lastMessageId) {
      presenceMessage = await updatePresenceEmbedMessage(guild, CHANNEL_ID);
    } else {
      try {
        presenceMessage = await channel.messages.fetch(global.lastMessageId);
      } catch (err) {
        console.error(
          "L'embed stocké en BDD est introuvable. Création d'un nouvel embed..."
        );
        presenceMessage = await updatePresenceEmbedMessage(guild, CHANNEL_ID);
      }
    }
    const newEmbed = await buildPresenceEmbed();
    await presenceMessage.edit({ embeds: [newEmbed] });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des membres ou mise à jour de l'embed :",
      error
    );
  }

  await sendTicketPanel(client);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      const context = {
        STAFF_ROLE_ID,
        ticketAuthorizedRoles: global.ticketAuthorizedRoles,
        ticketAuthorizedUsers: global.ticketAuthorizedUsers,
        updateTicketEmbed: () =>
          updateTicketEmbed(interaction.guild, interaction.channelId),
        staffStatus: global.staffStatus,
        updatePresenceEmbed: updatePresenceEmbedMessage,
        CHANNEL_ID,
      };

      await command.execute(interaction, client, context);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Une erreur est survenue.",
        flags: 1 << 6, // Équivalent EPHEMERAL
      });
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === "connectRobloxModal") {
      const username = interaction.fields.getTextInputValue("roblox_username");
      const discordId = interaction.user.id;

      try {
        const response = await axios.get(
          `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(
            username
          )}`
        );

        if (!response.data || response.data.Id === 0) {
          return interaction.reply({
            content:
              "Compte Roblox introuvable. Vérifie bien le nom d'utilisateur.",
            flags: 1 << 6,
          });
        }

        const robloxId = response.data.Id;
        const stmt = db.prepare(`
          INSERT INTO user_roblox (discord_id, roblox_username, roblox_id) 
          VALUES (?, ?, ?) 
          ON CONFLICT(discord_id) 
          DO UPDATE SET 
            roblox_username = excluded.roblox_username,
            roblox_id = excluded.roblox_id
        `);
        stmt.run(discordId, username, robloxId);

        await interaction.reply({
          content: `Ton compte Roblox **${username}** (ID: ${robloxId}) a été associé à ton compte Discord !`,
          flags: 1 << 6,
        });
      } catch (error) {
        console.error("Erreur lors de la connexion du compte Roblox :", error);
        await interaction.reply({
          content:
            "Erreur lors de la connexion du compte Roblox. Réessayez plus tard.",
          flags: 1 << 6,
        });
      }
    }
  } else if (interaction.isButton()) {
    const buttonHandler = require("./interactionCreate");
    buttonHandler(interaction);
  }
});

client.login(process.env.TOKEN);
