require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const https = require("https");

const {
  Client,
  GatewayIntentBits,
  Collection,
  AttachmentBuilder,
  EmbedBuilder,
  ActivityType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const { sendTicketPanel } = require("./ticketPanel");
const {
  updatePresenceEmbed,
  buildPresenceEmbed,
} = require("./commands/presence");
const db = require("./db");
global.database = db;

const app = express();
const PORT = process.env.API_PORT || 8080;

app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
    },
  })
);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

app.get("/auth", (req, res) => {
  if (req.session && req.session.accessToken) {
    res.json({ accessToken: req.session.accessToken });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

app.post("/auth/signout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Signout failed" });
    res.json({ message: "Signed out" });
  });
});

const getGuild = async (guildId) => {
  let guild = client.guilds.cache.get(guildId);
  if (!guild) {
    try {
      guild = await client.guilds.fetch(guildId);
    } catch (err) {
      throw new Error("Guild not found");
    }
  }
  return guild;
};

const guildFeatures = {};

const httpsOptions = {
  key: fs.readFileSync("./key.pem"),
  cert: fs.readFileSync("./cert.pem"),
};

app.get("/guilds/:guild", async (req, res) => {
  const guildId = req.params.guild;
  try {
    const guild = await getGuild(guildId);
    const guildInfo = {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ dynamic: true }),
      memberCount: guild.memberCount,
    };
    res.json(guildInfo);
  } catch (error) {
    res.status(404).json({ error: "Guild not found" });
  }
});

app.get("/guilds/:guild/features/:feature", (req, res) => {
  const { guild, feature } = req.params;
  const featuresConfig = guildFeatures[guild] || {};
  if (featuresConfig[feature]) {
    res.json(featuresConfig[feature]);
  } else {
    res.status(404).json({ error: "Feature not enabled or not found" });
  }
});

app.patch("/guilds/:guild/features/:feature", (req, res) => {
  const { guild, feature } = req.params;
  const options = req.body;
  if (!guildFeatures[guild] || !guildFeatures[guild][feature]) {
    return res.status(404).json({ error: "Feature not enabled" });
  }
  guildFeatures[guild][feature].options = {
    ...guildFeatures[guild][feature].options,
    ...options,
  };
  res.json(guildFeatures[guild][feature]);
});

app.post("/guilds/:guild/features/:feature", (req, res) => {
  const { guild, feature } = req.params;
  const options = req.body || {};
  if (!guildFeatures[guild]) {
    guildFeatures[guild] = {};
  }
  guildFeatures[guild][feature] = {
    enabled: true,
    options: options,
  };
  res.json(guildFeatures[guild][feature]);
});

app.delete("/guilds/:guild/features/:feature", (req, res) => {
  const { guild, feature } = req.params;
  if (guildFeatures[guild] && guildFeatures[guild][feature]) {
    delete guildFeatures[guild][feature];
    res.json({ message: "Feature disabled" });
  } else {
    res.status(404).json({ error: "Feature not enabled" });
  }
});

app.get("/guilds/:guild/roles", async (req, res) => {
  const guildId = req.params.guild;
  try {
    const guild = await getGuild(guildId);
    const roles = guild.roles.cache.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      permissions: r.permissions.serialize(),
    }));
    res.json(roles);
  } catch (error) {
    res.status(404).json({ error: "Guild not found" });
  }
});

app.get("/guilds/:guild/channels", async (req, res) => {
  const guildId = req.params.guild;
  try {
    const guild = await getGuild(guildId);
    const channels = guild.channels.cache.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));
    res.json(channels);
  } catch (error) {
    res.status(404).json({ error: "Guild not found" });
  }
});

https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Serveur HTTPS lancé sur le port ${PORT}`);
});

async function initDatabase() {
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS presence_embed (
          channel_id VARCHAR(255) PRIMARY KEY,
          message_id VARCHAR(255)
        )`
    );

    await db.execute(
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
      const newMessage = await channelObj.send({
        embeds: [embed],
        files: [file],
      });
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
  function updateBotStatus() {
    const totalMembers = client.guilds.cache.reduce(
      (acc, guild) => acc + guild.memberCount,
      0
    );
    console.log(`Mise à jour du statut : ${totalMembers} membres.`);

    try {
      client.user.setPresence({
        activities: [
          {
            name: `${totalMembers} members`,
            type: ActivityType.Watching,
          },
        ],
        status: "online",
      });
      console.log("Présence mise à jour");
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut :", err);
    }
  }
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  updateBotStatus();
  setInterval(updateBotStatus, 60000);

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
    const [rows] = await db.execute(
      `SELECT message_id FROM presence_embed WHERE channel_id = ?`,
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

client.on("messageCreate", async (message) => {
  if (
    global.reactionChannels &&
    global.reactionChannels.has(message.channel.id)
  ) {
    await message.react("✅");
    await message.react("❌");
  }

  if (message.author.bot || !message.guild) return;
  const guildId = message.guild.id;
  const discordId = message.author.id;
  const now = Date.now();

  try {
    const [configRows] = await db.execute(
      "SELECT enabled FROM antispam_config WHERE guild_id = ?",
      [guildId]
    );
    if (configRows.length && configRows[0].enabled) {
      if (!global.spamMap) global.spamMap = new Map();
      const spamKey = `${guildId}-${discordId}`;
      let timestamps = global.spamMap.get(spamKey) || [];
      timestamps.push(now);
      const spamTimeFrame = 7000; // 7 secondes
      timestamps = timestamps.filter((ts) => now - ts < spamTimeFrame);
      global.spamMap.set(spamKey, timestamps);

      console.log(
        `[AntiSpam] ${spamKey} a ${timestamps.length} messages dans ${spamTimeFrame}ms.`
      );

      const spamThreshold = 5;
      if (timestamps.length >= spamThreshold) {
        try {
          const fetched = await message.channel.messages.fetch({ limit: 100 });
          const messagesToDelete = fetched.filter(
            (m) =>
              m.author.id === discordId &&
              now - m.createdTimestamp < spamTimeFrame
          );
          if (messagesToDelete.size > 0) {
            await message.channel.bulkDelete(messagesToDelete, true);
          }
        } catch (err) {
          console.error(
            "Erreur lors de la suppression des messages spam :",
            err
          );
        }

        try {
          const [rows] = await db.execute(
            "SELECT warns, kicks FROM antispam_records WHERE guild_id = ? AND user_id = ?",
            [guildId, discordId]
          );
          let warns = 0;
          let kicks = 0;
          if (rows.length === 0) {
            await db.execute(
              "INSERT INTO antispam_records (guild_id, user_id, warns, kicks) VALUES (?, ?, 1, 0)",
              [guildId, discordId]
            );
            warns = 1;
          } else {
            warns = rows[0].warns + 1;
            kicks = rows[0].kicks;
            await db.execute(
              "UPDATE antispam_records SET warns = ? WHERE guild_id = ? AND user_id = ?",
              [warns, guildId, discordId]
            );
          }

          if (warns < 3) {
            message.channel.send(
              `<@${discordId}> Attention ! Ce comportement est considéré comme du spam. (Warn ${warns}/3)`
            );
          } else if (warns >= 3 && kicks < 2) {
            try {
              const member = await message.guild.members.fetch(discordId);
              if (member) {
                await member.kick("Anti-spam : accumulation de 3 warns");
                kicks++;
                await db.execute(
                  "UPDATE antispam_records SET kicks = ? WHERE guild_id = ? AND user_id = ?",
                  [kicks, guildId, discordId]
                );
                try {
                  await message.author.send(
                    `Vous avez été **kick** du serveur \`${message.guild.name}\` pour spam excessif (3 warns atteints).`
                  );
                } catch (err) {
                  console.error(
                    "Impossible d'envoyer un DM à l'utilisateur kick."
                  );
                }
                message.channel.send(
                  `<@${discordId}> a été **kick** pour spam (3 warns).`
                );
              }
            } catch (err) {
              console.error("Erreur lors du kick anti-spam :", err);
            }
          } else if (warns >= 3 && kicks >= 2) {
            try {
              const member = await message.guild.members.fetch(discordId);
              if (member) {
                await member.ban({
                  reason: "Anti-spam : accumulation de 3 warns et 2 kicks",
                });
                try {
                  await message.author.send(
                    `Vous avez été **banni** du serveur \`${message.guild.name}\` pour spam excessif (3 warns et 2 kicks accumulés).`
                  );
                } catch (err) {
                  console.error(
                    "Impossible d'envoyer un DM à l'utilisateur banni."
                  );
                }
                message.channel.send(
                  `<@${discordId}> a été **banni** pour spam excessif.`
                );
              }
            } catch (err) {
              console.error("Erreur lors du ban anti-spam :", err);
            }
          }
        } catch (err) {
          console.error("Erreur lors du traitement de l'antispam :", err);
        }
        global.spamMap.set(spamKey, []);
      }
    }
  } catch (err) {
    console.error(
      "Erreur lors de la lecture de la configuration anti-spam :",
      err
    );
  }

  if (!global.lastMessageTimestamps) global.lastMessageTimestamps = {};
  const xpKey = `${guildId}-${discordId}`;
  if (
    global.lastMessageTimestamps[xpKey] &&
    now - global.lastMessageTimestamps[xpKey] < 10000
  ) {
    return;
  }
  global.lastMessageTimestamps[xpKey] = now;

  const xpEarned = Math.max(1, Math.floor(message.content.length / 10));
  try {
    await db.execute(
      `INSERT INTO user_levels (guild_id, discord_id, xp, level)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE xp = xp + ?`,
      [guildId, discordId, xpEarned, xpEarned]
    );

    const [rows] = await db.execute(
      "SELECT xp, level FROM user_levels WHERE guild_id = ? AND discord_id = ?",
      [guildId, discordId]
    );
    if (rows.length > 0) {
      let { xp, level } = rows[0];
      const xpThreshold = level * 100;

      if (xp >= xpThreshold) {
        level++;
        await db.execute(
          "UPDATE user_levels SET level = ? WHERE guild_id = ? AND discord_id = ?",
          [level, guildId, discordId]
        );

        const [configRows] = await db.execute(
          "SELECT system_enabled, announce_enabled, announce_channel FROM level_config WHERE guild_id = ?",
          [guildId]
        );
        let announce = false;
        let announceChannelId = null;
        if (configRows.length > 0 && configRows[0].system_enabled) {
          announce = configRows[0].announce_enabled;
          announceChannelId = configRows[0].announce_channel;
        }

        if (announce) {
          const embed = new EmbedBuilder()
            .setTitle("Nouveau Niveau Atteint !")
            .setDescription(
              `<@${discordId}> vient d'atteindre le niveau **${level}** !`
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setColor("#00FF00")
            .setTimestamp();

          let channel =
            message.guild.channels.cache.get(announceChannelId) ||
            message.channel;
          channel.send({ embeds: [embed] });
        }
      }
    }
  } catch (err) {
    console.error("Erreur dans le système d'XP :", err);
  }
  try {
    const [sanctionConfigRows] = await db.execute(
      "SELECT channel_id, embed_channel_id FROM sanction_config WHERE guild_id = ?",
      [guildId]
    );

    if (sanctionConfigRows.length) {
      const { channel_id, embed_channel_id } = sanctionConfigRows[0];
      if (message.channel.id === channel_id) {
        const regex =
          /^Pseudo\s*:\s*(.+)\nRaison\s*:\s*(.+)\nSanction\s*:\s*(.+)$/i;
        const match = message.content.match(regex);
        if (match) {
          const pseudo = match[1].trim();
          const raison = match[2].trim();
          const sanctionRaw = match[3].trim();

          let duration = "";
          const durRegex = /^(\d+)\s*([JMA])$/i;

          if (/^warn$/i.test(sanctionRaw)) {
            duration = "Warn";
          } else if (/^kick$/i.test(sanctionRaw)) {
            duration = "Kick";
          } else if (durRegex.test(sanctionRaw)) {
            const parts = sanctionRaw.match(durRegex);
            const nombre = parts[1];
            const uniteLetter = parts[2].toUpperCase();
            let unite;
            if (uniteLetter === "J") unite = "jour(s)";
            else if (uniteLetter === "M") unite = "mois";
            else if (uniteLetter === "A") unite = "an(s)";
            duration = `${nombre} ${unite}`;
          } else if (/^(perm|permanent)$/i.test(sanctionRaw)) {
            duration = "Permanent";
          } else {
            return;
          }

          await db.execute(
            "INSERT INTO sanctions (guild_id, punisher_id, pseudo, raison, duration) VALUES (?, ?, ?, ?, ?)",
            [guildId, message.author.id, pseudo, raison, duration]
          );

          const embed = new EmbedBuilder()
            .setTitle("Sanction enregistrée")
            .addFields(
              { name: "Pseudo", value: pseudo, inline: true },
              { name: "Raison", value: raison, inline: true },
              { name: "Sanction", value: duration, inline: true },
              {
                name: "Sanctionné par",
                value: `<@${message.author.id}>`,
                inline: true,
              }
            )
            .setColor(0xff0000)
            .setTimestamp();

          const sanctionEmbedChannel =
            message.guild.channels.cache.get(embed_channel_id);
          if (sanctionEmbedChannel) {
            sanctionEmbedChannel.send({ embeds: [embed] });
          }
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors du traitement des sanctions :", err);
  }
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
        flags: 1 << 6,
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
