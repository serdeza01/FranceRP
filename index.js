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
const axios = require("axios");

const { sendTicketPanel } = require("./ticketPanel");
const {
  updatePresenceEmbed,
  buildPresenceEmbed,
} = require("./commands/presence");

const db = require("./db");
global.database = db;

async function initDatabase() {
  try {
    await db
      .promise()
      .execute(
        `CREATE TABLE IF NOT EXISTS presence_embed (
          channel_id VARCHAR(255) PRIMARY KEY,
          message_id VARCHAR(255)
        )`
      );

    await db.promise().execute(
      `CREATE TABLE IF NOT EXISTS user_roblox (
          discord_id VARCHAR(255) PRIMARY KEY,
          roblox_username VARCHAR(255),
          roblox_id VARCHAR(255)
        )`
    );

    console.log("Tables créées (si elles n'existaient pas déjà)");
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la DB:", error);
  }
}

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
    const channelObj = await client.channels.fetch(channelId);
    if (global.lastMessageId) {
      sentMessage = await channelObj.messages
        .fetch(global.lastMessageId)
        .catch(() => null);
      if (sentMessage) {
        await sentMessage.edit({ embeds: [embed], files: [file] });
      }
    }

    if (!global.lastMessageId || !sentMessage) {
      const newMessage = await channelObj.send({ embeds: [embed], files: [file] });
      global.lastMessageId = newMessage.id;

      await db.promise().execute(
        `
        INSERT INTO presence_embed (channel_id, message_id) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE message_id = VALUES(message_id)
      `,
        [channelId, newMessage.id]
      );
      return newMessage;
    }

    return sentMessage;
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
    await client.application.commands.set(
      client.commands.map((command) => command.data)
    );
    console.log("Commandes enregistrées globalement !");
  } catch (error) {
    console.error(
      "Erreur lors de l'enregistrement des commandes globales :",
      error
    );
  }

  try {
    const [rows] = await db
      .promise()
      .execute(
        `
        SELECT message_id 
        FROM presence_embed 
        WHERE channel_id = ?
      `,
        [CHANNEL_ID]
      );
    if (rows && rows.length > 0 && rows[0].message_id) {
      global.lastMessageId = rows[0].message_id;
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de l'embed de présence en BDD :",
      error
    );
  }

  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.error("Le bot n'est dans aucun serveur.");
      return;
    }
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
    if (presenceMessage) {
      await presenceMessage.edit({ embeds: [newEmbed] });
    }
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
        flags: 1 << 6, // Équivalent d'EPHEMERAL
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
        await db.promise().execute(
          `
          INSERT INTO user_roblox (discord_id, roblox_username, roblox_id) 
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            roblox_username = VALUES(roblox_username),
            roblox_id = VALUES(roblox_id)
        `,
          [discordId, username, robloxId]
        );

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

(async () => {
  await initDatabase();
  client.login(process.env.TOKEN);
})();
