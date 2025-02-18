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
const db = require("./db");
const axios = require("axios");

const { updatePresenceEmbed, buildPresenceEmbed } = require("./commands/presence");

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
  // Vérification si la commande possède bien une propriété "data" avec "name"
  if (!command.data || !command.data.name) {
    console.warn(`Le fichier ${file} ne possède pas de propriété data.name. Commande ignorée.`);
    continue;
  }
  client.commands.set(command.data.name, command);
}

global.staffStatus = new Map();
global.lastMessageId = null;

// ***** Nouvelle partie pour les tickets *****
global.ticketAuthorizedRoles = new Set();
global.ticketAuthorizedUsers = new Set();
// Remplace "VOTRE_TICKET_CHANNEL_ID" par l'ID réel du salon des tickets
const ticketChannelId = "VOTRE_TICKET_CHANNEL_ID"; 
// ***********************************************

const STAFF_ROLE_ID = "1304151263851708458";
const CHANNEL_ID = "1337086501778882580";
const staffUsernames = [];

/**
 * Met à jour l'embed de présence dans le salon défini.
 *
 * Si le message existe déjà (son ID est dans global.lastMessageId),
 * il sera édité. Sinon, un nouveau message est envoyé et son ID est stocké
 * en BDD.
 *
 * @param {Guild} guild Le serveur Discord.
 * @param {string} channelId L'ID du salon où envoyer l'embed.
 */
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
      sentMessage = await channel.messages.fetch(global.lastMessageId).catch(() => null);
      if (sentMessage) {
        await sentMessage.edit({ embeds: [embed], files: [file] });
      }
    }

    if (!global.lastMessageId || !sentMessage) {
      const newMessage = await channel.send({ embeds: [embed], files: [file] });
      global.lastMessageId = newMessage.id;

      const query =
        "INSERT INTO presence_embed (channel_id, message_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE message_id = VALUES(message_id)";
      await db.execute(query, [channelId, newMessage.id]);
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'embed :", error);
  }
}

// ***** Nouvelle fonction pour mettre à jour l'embed ticket *****
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
// ***********************************************

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
    const [rows] = await db.execute(
      "SELECT message_id FROM presence_embed WHERE channel_id = ? LIMIT 1",
      [CHANNEL_ID]
    );
    if (rows.length > 0 && rows[0].message_id) {
      global.lastMessageId = rows[0].message_id;
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de l'embed de présence en BDD :", error);
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
        console.error("L'embed stocké en BDD est introuvable dans le salon. Un nouvel embed va être créé.");
        presenceMessage = await updatePresenceEmbedMessage(guild, CHANNEL_ID);
      }
    }
    const newEmbed = await buildPresenceEmbed();
    await presenceMessage.edit({ embeds: [newEmbed] });
  } catch (error) {
    console.error("Erreur lors de la récupération des membres ou mise à jour de l'embed :", error);
  }

  await sendTicketPanel(client);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      if (
        ["add_role", "remove_role", "add_user", "remove_user"].includes(interaction.commandName)
      ) {
        await command.execute(interaction, {
          STAFF_ROLE_ID,
          ticketAuthorizedRoles: global.ticketAuthorizedRoles,
          ticketAuthorizedUsers: global.ticketAuthorizedUsers,
          updateTicketEmbed,
          ticketChannelId,
        });
      } else {
        await command.execute(interaction, {
          staffStatus: global.staffStatus,
          updatePresenceEmbed: updatePresenceEmbedMessage,
          CHANNEL_ID,
          STAFF_ROLE_ID,
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Une erreur est survenue.",
        ephemeral: true,
      });
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === "connectRobloxModal") {
      const username = interaction.fields.getTextInputValue("roblox_username");
      const discordId = interaction.user.id;

      try {
        const response = await axios.get(
          `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`
        );

        if (!response.data || response.data.Id === 0) {
          return interaction.reply({
            content: "Compte Roblox introuvable. Vérifie bien le nom d'utilisateur.",
            ephemeral: true,
          });
        }
        const robloxId = response.data.Id;
        const querySelect = "SELECT * FROM user_roblox WHERE discord_id = ?";
        const [rows] = await db.execute(querySelect, [discordId]);

        if (rows && rows.length > 0) {
          const queryUpdate = "UPDATE user_roblox SET roblox_username = ?, roblox_id = ? WHERE discord_id = ?";
          await db.execute(queryUpdate, [username, robloxId, discordId]);
        } else {
          const queryInsert = "INSERT INTO user_roblox (discord_id, roblox_username, roblox_id) VALUES (?, ?, ?)";
          await db.execute(queryInsert, [discordId, username, robloxId]);
        }

        await interaction.reply({
          content: `Ton compte Roblox **${username}** (ID: ${robloxId}) a été trouvé et associé à ton compte Discord !`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Erreur lors de la connexion du compte Roblox :", error);
        return interaction.reply({
          content: "Une erreur est survenue lors de la connexion de ton compte Roblox. Merci de réessayer plus tard.",
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isButton()) {
    const buttonHandler = require("./interactionCreate");
    buttonHandler(interaction);
  }
});

client.login(process.env.TOKEN);
