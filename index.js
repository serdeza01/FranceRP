require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
console.log(
  `[DÉBOGAGE BDD] Hôte: ${process.env.DB_HOST}, Base: ${process.env.DB_NAME}, Utilisateur: ${process.env.DB_USER}`
);
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const https = require("https");
const schedule = require("node-schedule");
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

const { sendTicketPanel } = require("./tasks/ticketPanel");
const db = require("./db");
global.database = db;

const PORT = process.env.API_PORT || 8080;
const { runAutoBackups } = require("./tasks/backupWorker");

const app = express();
const port = process.env.HEALTH_PORT || 3001;

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Health endpoint listening on port ${port}`);
});

async function initDatabase() {
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS presence_embed (channel_id VARCHAR(255) PRIMARY KEY, message_id VARCHAR(255))`
    );

    await db.execute(
      `CREATE TABLE IF NOT EXISTS user_roblox (discord_id VARCHAR(255) PRIMARY KEY, roblox_username VARCHAR(255), roblox_id VARCHAR(255))`
    ); // CRÉATION/VÉRIFICATION DE LA TABLE sanctions (Corrigé de l'espace)

    await db.execute(
      `CREATE TABLE IF NOT EXISTS sanctions (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(255) NOT NULL, punisher_id VARCHAR(255) NOT NULL, pseudo VARCHAR(255) NOT NULL, raison TEXT, duration VARCHAR(255), created_at DATETIME NOT NULL)`
    ); // NOUVELLE TABLE: Suivi des sanctions non enregistrées (Audit)

    await db.execute(
      `CREATE TABLE IF NOT EXISTS sanction_misses (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(255) NOT NULL, punisher_roblox_pseudo VARCHAR(255) NOT NULL, punisher_discord_id VARCHAR(255) NOT NULL, target_pseudo VARCHAR(255) NOT NULL, action_type VARCHAR(50) NOT NULL, log_message_id VARCHAR(255) NOT NULL UNIQUE, alert_time DATETIME NOT NULL, resolved_at DATETIME NULL)`
    ); // CRÉATION/VÉRIFICATION DE LA TABLE sanction_config

    await db.execute(
      `CREATE TABLE IF NOT EXISTS sanction_config (guild_id VARCHAR(255) PRIMARY KEY, embed_channel_id VARCHAR(255), channel_ids JSON, allowed_role_id VARCHAR(255))`
    ); // MIGRATION 1 : AJOUT DE log_channel_id (pour les logs externes)

    await db
      .execute(
        `ALTER TABLE sanction_config ADD COLUMN log_channel_id VARCHAR(255) AFTER allowed_role_id`
      )
      .catch((e) => {
        if (!e.message.includes("duplicate column")) {
          console.warn(
            "[DB] Avertissement lors de la migration de sanction_config (log_channel_id):",
            e.message
          );
        }
      }); // MIGRATION 2 : AJOUT DE admin_alert_channel_id (pour les logs d'audit)

    await db
      .execute(
        `ALTER TABLE sanction_config ADD COLUMN admin_alert_channel_id VARCHAR(255) AFTER log_channel_id`
      )
      .catch((e) => {
        if (!e.message.includes("duplicate column")) {
          console.warn(
            "[DB] Avertissement lors de la migration de sanction_config (admin_alert_channel_id):",
            e.message
          );
        }
      });

    await db.execute(
      `CREATE TABLE IF NOT EXISTS roblox_to_discord (roblox_pseudo VARCHAR(255) PRIMARY KEY, discord_id VARCHAR(255))`
    );

    console.log("Tables créées (si elles n'existaient pas déjà)");
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la DB:", error);
  }
}

function updatePresenceEmbedMessage() {
  console.log(
    "AVERTISSEMENT : La fonction updatePresenceEmbedMessage a été appelé mais n'est pas active."
  );
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

const GUILD_ID_FOR_COMMANDS = "1313028772588421220";
const commandsPath = path.join(__dirname, "commands");

function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      const command = require(fullPath);

      if (!command.data || !command.data.name) {
        console.warn(
          `[WARNING] Le fichier ${fullPath} n'a pas de propriété data.name, commande ignorée.`
        );
        continue;
      }

      client.commands.set(command.data.name, command);
    }
  }
}

loadCommands(commandsPath);

console.log(`✅  ${client.commands.size} commandes chargées.`);

global.staffStatus = new Map();
global.lastMessageId = null;
global.ticketAuthorizedRoles = new Set();
global.ticketAuthorizedUsers = new Set();
global.reactionChannels = new Set();
const sanctionChecks = new Map();
const auditChecks = new Map(); // NOUVEAU: Map pour les vérifications finales de 2 heures

const STAFF_ROLE_ID = "1427200751855210566";
const CHANNEL_ID = "1337086501778882580";
const staffUsernames = [];

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

function updateBotStatusRotating() {
  let statusIndex = 0;

  const statuses = [
    () => ({
      name: `${client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0
      )} members`,
      type: ActivityType.Watching,
    }),
    () => ({
      name: `.gg/rpfrance`,
      type: ActivityType.Listening,
    }),
  ];

  const updateStatus = () => {
    const presence = statuses[statusIndex % statuses.length]();
    try {
      client.user.setPresence({
        activities: [presence],
        status: "online",
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut :", err);
    }
    statusIndex++;
  };

  updateStatus();
  setInterval(updateStatus, 20000);
}

// NOUVELLE FONCTION: Vérification finale d'audit
async function checkFinalSanctionStatus(
  guildId,
  logMessageId,
  targetPseudo,
  actionTypeDb, // C'est le type 'Kick' ou 'Permanent'
  moderatorDiscordId,
  adminAlertChannelId
) {
  try {
    console.log(
      `[DBG AUDIT] Début de la vérification finale (2h après alerte) pour Log ID: ${logMessageId}`
    );
    const [missRows] = await db.execute(
      `SELECT * FROM sanction_misses WHERE log_message_id = ? AND resolved_at IS NULL`,
      [logMessageId]
    );
    if (missRows.length === 0) {
      console.log(
        `[DBG AUDIT] Manquement déjà marqué comme résolu ou introuvable (Vérification finale).`
      );
      return;
    }
    const missEntry = missRows[0];

    const [dbSanctionRows] = await db.execute(
      `SELECT COUNT(*) as count FROM sanctions WHERE guild_id = ? AND pseudo = ? AND duration = ? AND created_at >= ?`,
      [guildId, targetPseudo, actionTypeDb, missEntry.alert_time]
    );

    const isResolved = dbSanctionRows[0].count > 0;

    if (isResolved) {
      await db.execute(
        `UPDATE sanction_misses SET resolved_at = NOW() WHERE log_message_id = ?`,
        [logMessageId]
      );
      console.log(
        `[DBG AUDIT] ✅ Manquement RÉSOLU (Vérification finale) pour ${targetPseudo}.`
      );
    } else {
      console.log(
        `[DBG AUDIT] ❌ Manquement NON RÉSOLU (Vérification finale) pour ${targetPseudo}. Envoi de l'alerte finale admin.`
      );

      if (adminAlertChannelId) {
        const guild = client.guilds.cache.get(guildId);
        const adminChannel = guild
          ? await guild.channels.fetch(adminAlertChannelId).catch(() => null)
          : null;

        if (adminChannel) {
          const finalEmbed = new EmbedBuilder()
            .setTitle(`🚨 Oubli de Signalement🚨`)
            .setDescription(
              `Le modérateur <@${moderatorDiscordId}> (**${missEntry.punisher_roblox_pseudo}**) n'a **toujours pas signalé** la sanction appliquée à **${targetPseudo}**.`
            )
            .setColor("Red")
            .addFields(
              { name: "Cible Sanctionnée", value: targetPseudo, inline: true },
              {
                name: "Modérateur Concerné",
                value: `<@${moderatorDiscordId}> (${missEntry.punisher_roblox_pseudo})`,
                inline: true,
              },
              {
                name: "Type d'Action Oubliée",
                value: actionTypeDb,
                inline: true,
              },
              {
                name: "Statut",
                value: "🔴 Pas signalé après 6 heures",
                inline: false,
              }
            )
            .setFooter({ text: `Log original ID: ${logMessageId}` })
            .setTimestamp();

          await adminChannel.send({ embeds: [finalEmbed] });
        }
      }
    }
  } catch (error) {
    console.error(
      `Erreur dans checkFinalSanctionStatus pour Log ID ${logMessageId}:`,
      error
    );
  }
}

/**
 * Fonction pour traiter l'embed de sanction et planifier la vérification initiale (4h)
 * @param {import('discord.js').Message} message
 * @param {string} logChannelId
 */
async function handleLogSanctionEmbed(message, logChannelId) {
  if (!message.author.bot || message.embeds.length === 0) {
    return;
  }

  const embed = message.embeds[0];

  const targetField = embed.fields.find((f) => f.name === "Target");
  const authorField = embed.fields.find((f) => f.name === "Author");
  const actionField = embed.fields.find((f) => f.name === "Action");

  const fieldNames = embed.fields.map((f) => `"${f.name}"`).join(", ");

  if (!fieldNames) {
    console.log(`[DBG LOG] ❌ Embed a 0 champs. Vérifiez si l'embed est vide.`);
  } else {
    console.log(`[DBG LOG] Champs trouvés dans l'embed: ${fieldNames}`);
  }

  if (!targetField || !authorField || !actionField) {
    console.log(
      `[DBG LOG] ❌ Structure de l'embed incorrecte. Target: ${!!targetField}, Author: ${!!authorField}, Action: ${!!actionField}`
    );
    return;
  }

  const targetPseudoRaw = targetField.value;
  const authorPseudoRaw = authorField.value;
  const action = actionField.value.toLowerCase();

  const markdownRegex = /^\[(.+?)\]\(.+?\)$/;

  const targetMatch = targetPseudoRaw.match(markdownRegex);
  const authorMatch = authorPseudoRaw.match(markdownRegex);

  const targetPseudo = targetMatch
    ? targetMatch[1].trim()
    : targetPseudoRaw.trim();
  const authorPseudo = authorMatch
    ? authorMatch[1].trim()
    : authorPseudoRaw.trim();

  console.log(
    `[DBG LOG] Données extraites (Nettoyées): Target=${targetPseudo}, Author=${authorPseudo}, Action=${action}`
  );
  if (
    action.includes("kicked") ||
    (action.includes("banned") && !action.includes("unbanned"))
  ) {
    const isKick = action.includes("kicked");
    const actionType = isKick ? "Kick" : "Ban";
    const actionTypeDb = isKick ? "Kick" : "Ban";

    const initialCheckTimeMs = 4 * 60 * 60 * 1000;
    const finalCheckTimeMs = 2 * 60 * 60 * 1000;

    const checkKey = `${targetPseudo}-${actionType}-${message.id}`;
    const guildId = message.guild.id;

    console.log(
      `[DBG LOG] ✅ Action '${actionType}' VRAIMENT détectée. Planification de la vérification initiale dans ${
        initialCheckTimeMs / (60 * 60 * 1000)
      } heures.`
    );

    const timeoutId = setTimeout(async () => {
      sanctionChecks.delete(checkKey);

      console.log(
        `[DBG LOG] 🕒 Début de la vérification initiale (4h) pour ${targetPseudo} (${actionType}) après timeout.`
      );

      try {
        const [dbSanctionRows] = await db.execute(
          `SELECT * FROM sanctions WHERE guild_id = ? AND pseudo = ? AND duration = ? ORDER BY created_at DESC LIMIT 1`,
          [guildId, targetPseudo, actionTypeDb]
        );

        const isRegistered =
          dbSanctionRows.length > 0 &&
          dbSanctionRows[0].created_at.getTime() >= message.createdAt.getTime();

        console.log(
          `[DBG LOG] DB Query Result (Initial Check): ${dbSanctionRows.length} rows found. IsRegistered: ${isRegistered}`
        );

        if (!isRegistered) {
          console.log(
            `[DBG LOG] 🚨 Sanction non enregistrée (4h). Préparation des alertes pour modérateur ${authorPseudo} et admins.`
          );
          const [linkRows] = await db.execute(
            `SELECT discord_id FROM roblox_to_discord WHERE roblox_pseudo = ?`,
            [authorPseudo]
          );
          const [configRows] = await db.execute(
            `SELECT admin_alert_channel_id FROM sanction_config WHERE guild_id = ?`,
            [guildId]
          );

          const moderatorDiscordId =
            linkRows.length > 0 ? linkRows[0].discord_id : null;
          const adminAlertChannelId =
            configRows.length > 0 ? configRows[0].admin_alert_channel_id : null;

          if (moderatorDiscordId) {
            console.log(
              `[DBG LOG] Modérateur lié trouvé: ${moderatorDiscordId}.`
            );
            const modMember = await message.guild.members
              .fetch(moderatorDiscordId)
              .catch(() => null);
            if (modMember) {
              try {
                const embedAlert = new EmbedBuilder()
                  .setTitle("⏰ Rappel : Sanction Non Signalée ⏰")
                  .setDescription(
                    `Bonjour ${modMember},\n\nIl semble que la sanction **${actionType}** appliquée à **${targetPseudo}** (par votre action via **${authorPseudo}**) il y a 4 heures n'a **pas été signalée** dans le système.\n\nMerci de la signaler dès que possible.`
                  )
                  .addFields(
                    { name: "Cible", value: targetPseudo, inline: true },
                    { name: "Action", value: actionType, inline: true },
                    {
                      name: "Heure du Log Initial",
                      value: `<t:${Math.floor(
                        message.createdAt.getTime() / 1000
                      )}:R>`,
                      inline: false,
                    }
                  )
                  .setColor("Yellow")
                  .setFooter({ text: `Log ID: ${message.id}` });

                await modMember.send({ embeds: [embedAlert] });
                console.log(
                  `[DBG LOG] Alerte MP envoyée à ${modMember.user.tag}.`
                );
              } catch (dmError) {
                console.warn(
                  `[DBG LOG] ⚠️ Impossible d'envoyer l'alerte MP à ${modMember.user.tag}. L'utilisateur a peut-être bloqué les DMs.`
                );
              }
              const alertTime = new Date();
              await db.execute(
                `INSERT INTO sanction_misses
                   (guild_id, punisher_roblox_pseudo, punisher_discord_id, target_pseudo, action_type, log_message_id, alert_time) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE alert_time = VALUES(alert_time)`,
                [
                  guildId,
                  authorPseudo,
                  moderatorDiscordId,
                  targetPseudo,
                  actionTypeDb,
                  message.id,
                  alertTime,
                ]
              );
              console.log(`[DBG AUDIT] Manquement enregistré/mis à jour.`);

              if (adminAlertChannelId) {
                const adminChannel = await message.guild.channels
                  .fetch(adminAlertChannelId)
                  .catch(() => null);
                if (adminChannel) {
                  const adminEmbed = new EmbedBuilder()
                    .setTitle(`📝 Oubli de Signalement Détecté`)
                    .setDescription(
                      `Le modérateur <@${moderatorDiscordId}> (**${authorPseudo}**) n'a pas signalé la sanction de **${targetPseudo}** (Action: ${actionType}) après 4 heures. Un rappel lui a été envoyé en MP.`
                    )
                    .setColor("Orange")
                    .addFields(
                      { name: "Cible", value: targetPseudo, inline: true },
                      {
                        name: "Modérateur",
                        value: `<@${moderatorDiscordId}> (${authorPseudo})`,
                        inline: true,
                      },
                      { name: "Type", value: actionType, inline: true }
                    )
                    .setFooter({ text: `Vérification finale dans 2 heures.` })
                    .setTimestamp(alertTime);

                  await adminChannel.send({ embeds: [adminEmbed] });
                  console.log(
                    `[DBG LOG] Confirmation admin envoyée dans #${adminChannel.name}.`
                  );
                } else {
                  console.warn(
                    `[DBG LOG] ⚠️ Canal admin (${adminAlertChannelId}) introuvable.`
                  );
                }
              } else {
                console.log(`[DBG LOG] Aucun canal d'alerte admin configuré.`);
              }
              const auditTimeoutId = setTimeout(async () => {
                auditChecks.delete(message.id);
                await checkFinalSanctionStatus(
                  guildId,
                  message.id,
                  targetPseudo,
                  actionTypeDb,
                  moderatorDiscordId,
                  adminAlertChannelId
                );
              }, finalCheckTimeMs);
              auditChecks.set(message.id, auditTimeoutId);
              console.log(
                `[DBG AUDIT] Vérification finale planifiée dans ${
                  finalCheckTimeMs / (60 * 60 * 1000)
                } heures.`
              );
            } else {
              console.warn(
                `[DBG LOG] ❌ Modérateur Discord trouvé (${moderatorDiscordId}) mais membre introuvable dans la guilde.`
              );
              if (adminAlertChannelId) {
                const adminChannel = await message.guild.channels
                  .fetch(adminAlertChannelId)
                  .catch(() => null);
                if (adminChannel) {
                  await adminChannel.send(
                    `🚨 **Erreur d'Audit:** Impossible de trouver le membre Discord (<@${moderatorDiscordId}>) lié au pseudo Roblox **${authorPseudo}** pour la sanction sur **${targetPseudo}** (Log ID: ${message.id}).`
                  );
                }
              }
            }
          } else {
            console.warn(
              `[DBG LOG] ❌ Modérateur Discord non trouvé pour: ${authorPseudo}. Impossible d'envoyer l'alerte.`
            );
            if (adminAlertChannelId) {
              const adminChannel = await message.guild.channels
                .fetch(adminAlertChannelId)
                .catch(() => null);
              if (adminChannel) {
                await adminChannel.send(
                  `🚨 **Erreur d'Audit:** Impossible de trouver le modérateur Discord lié au pseudo Roblox **${authorPseudo}** pour la sanction sur **${targetPseudo}** (Log ID: ${message.id}). Veuillez vérifier la liaison via /lier-moderateur.`
                );
              }
            }
          }
        } else {
          console.log(
            `[DBG LOG] ✅ Sanction pour ${targetPseudo} enregistrée correctement avant l'alerte.`
          );
        }
      } catch (error) {
        console.error(
          `[DBG LOG] ❌ ERREUR IRRÉCUPÉRABLE lors de la vérification initiale (4h) pour ${targetPseudo}:`,
          error
        );
      }
    }, initialCheckTimeMs);

    sanctionChecks.set(checkKey, timeoutId);
  }
}

client.once("ready", async () => {
  runAutoBackups(client);
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  updateBotStatusRotating();

  try {
    await client.application.commands.set(
      client.commands.map((command) => command.data),
      GUILD_ID_FOR_COMMANDS
    );
    console.log("Commandes enregistrées sur le serveur de dev !");
  } catch (error) {
    console.error(
      "Erreur lors de l'enregistrement des commandes de dev :",
      error
    );
  }

  await sendTicketPanel(client);
});

client.on("messageCreate", async (message) => {
  if (message.content) {
    console.log(
      `[DBG MESSAGE] Message reçu (Auteur: ${
        message.author.tag
      }, Contenu: ${message.content.substring(0, 50)}...)`
    );
  }

  if (
    global.reactionChannels &&
    global.reactionChannels.has(message.channel.id)
  ) {
    await message.react("✅");
    await message.react("❌");
  }

  if (message.author.bot || !message.guild) {
    if (message.author.bot) {
      console.log(
        `[DBG MESSAGE] Auteur est un bot. Sortie précoce. (Sauf si c'est le bot de log externe)`
      );
    }
    if (!message.guild) {
      console.log(`[DBG MESSAGE] Message hors guilde (DM). Sortie précoce.`);
    }
  }

  if (!message.guild) return;

  const guildId = message.guild.id;
  const discordId = message.author.id;
  const now = Date.now();

  if (!message.author.bot) {
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
        const spamTimeFrame = 7000;
        timestamps = timestamps.filter((ts) => now - ts < spamTimeFrame);
        global.spamMap.set(spamKey, timestamps);

        const spamThreshold = 5;
        if (timestamps.length >= spamThreshold) {
          try {
            const fetched = await message.channel.messages.fetch({
              limit: 100,
            });
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
                  await member
                    .send(
                      `Vous avez été **kick** du serveur \`${message.guild.name}\` pour spam excessif (3 warns atteints).`
                    )
                    .catch(() =>
                      console.error(
                        "Impossible d'envoyer un DM à l'utilisateur kick."
                      )
                    );
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
                  await member
                    .send(
                      `Vous avez été **banni** du serveur \`${message.guild.name}\` pour spam excessif (3 warns et 2 kicks accumulés).`
                    )
                    .catch(() =>
                      console.error(
                        "Impossible d'envoyer un DM à l'utilisateur banni."
                      )
                    );
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

    try {
      if (!global.lastMessageTimestamps) global.lastMessageTimestamps = {};
      const xpKey = `${guildId}-${discordId}`;
      if (
        global.lastMessageTimestamps[xpKey] &&
        now - global.lastMessageTimestamps[xpKey] < 10000
      ) {
      } else {
        global.lastMessageTimestamps[xpKey] = now;
        const xpEarned = Math.max(1, Math.floor(message.content.length / 10));

        await db.execute(
          `INSERT INTO user_levels (guild_id, discord_id, xp, level) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE xp = xp + ?`,
          [guildId, discordId, xpEarned, xpEarned]
        );

        const [rows] = await db.execute(
          "SELECT xp, level FROM user_levels WHERE guild_id = ? AND discord_id = ?",
          [guildId, discordId]
        );
        if (rows.length > 0) {
          let { xp, level } = rows[0];
          let xpThreshold = Math.floor(13.3 * Math.pow(level, 2));
          let leveledUp = false;
          while (xp >= xpThreshold) {
            xp -= xpThreshold;
            level++;
            leveledUp = true;
            xpThreshold = Math.floor(13.3 * Math.pow(level, 2));
          }
          await db.execute(
            "UPDATE user_levels SET xp = ?, level = ? WHERE guild_id = ? AND discord_id = ?",
            [xp, level, guildId, discordId]
          );
          const [configRows] = await db.execute(
            "SELECT system_enabled, announce_enabled, announce_channel FROM level_config WHERE guild_id = ?",
            [guildId]
          );

          if (
            configRows.length > 0 &&
            configRows[0].system_enabled &&
            configRows[0].announce_enabled &&
            leveledUp
          ) {
            const embed = new EmbedBuilder()
              .setTitle("Nouveau Niveau Atteint !")
              .setDescription(
                `<@${discordId}> vient d'atteindre le niveau **${level}** !`
              )
              .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
              .setColor("#00FF00")
              .setTimestamp();
            let channel =
              message.guild.channels.cache.get(
                configRows[0].announce_channel
              ) || message.channel;
            channel.send({ embeds: [embed] });
          }
        }
      }
    } catch (err) {
      console.error("Erreur dans le système d'XP :", err);
    }
  }

  try {
    console.log(
      `[DBG SANCTION] Tentative de lecture config pour Guild ID: ${guildId}`
    );

    const [sanctionConfigRows] = await db.execute(
      "SELECT channel_ids, embed_channel_id, log_channel_id, admin_alert_channel_id FROM sanction_config WHERE guild_id = ?",
      [message.guild.id]
    );

    if (sanctionConfigRows.length === 0) {
      console.log(
        "[DBG SANCTION] ❌ Aucune ligne trouvée dans sanction_config. Sortie."
      );
      return;
    }

    console.log("[DBG SANCTION] ✅ Configuration de sanction trouvée.");
    const config = sanctionConfigRows[0];

    const logChannelId = config.log_channel_id;
    if (logChannelId) {
      console.log(`[DBG SANCTION] - Log Channel ID (DB): ${logChannelId}`);
      console.log(`[DBG SANCTION] - Message Channel ID: ${message.channel.id}`);
    } else {
      console.log(
        `[DBG SANCTION] ❌ Log Channel ID non configuré (null ou vide).`
      );
    }

    if (logChannelId && message.channel.id === logChannelId) {
      if (message.embeds.length > 0) {
        console.log(
          "[DBG SANCTION] 🟢 Message détecté dans le canal de surveillance. Traitement de l'embed..."
        );
        await handleLogSanctionEmbed(message, config.log_channel_id);
      } else {
        console.log(
          "[DBG SANCTION] 🟠 Message détecté dans le canal de surveillance mais n'est PAS un embed."
        );
      }
    }

    if (message.author.bot) return;

    let channelIds = [];
    const dbValue = config.channel_ids;

    if (dbValue) {
      if (Array.isArray(dbValue)) {
        channelIds = dbValue;
      } else if (typeof dbValue === "string") {
        try {
          const parsedData = JSON.parse(dbValue);
          if (Array.isArray(parsedData)) {
            channelIds = parsedData;
          }
        } catch (e) {
          console.error(
            `[Sanctions] Donnée channel_ids invalide pour guild ${message.guild.id}, impossible de parser :`,
            dbValue
          );
        }
      }
    }
    if (!channelIds.includes(message.channel.id)) return;

    const regex =
      /^Pseudo\s*:\s*(.+)\nRaison\s*:\s*(.+)\nSanction\s*:\s*([\w\s]+)[\s\S]*$/i;
    const match = message.content.match(regex);
    if (!match) return;

    const pseudo = match[1].trim();
    const raison = match[2].trim();
    const sanctionRaw = match[3].trim();

    let duration = "";
    const durRegex = /^(\d+)\s*([JMA])$/i;
    if (/^warn$/i.test(sanctionRaw)) {
      duration = "Warn";
    } else if (/^kick$/i.test(sanctionRaw)) {
      duration = "Kick";
    } else if (/^mute$/i.test(sanctionRaw)) {
      duration = "Mute";
    } else if (durRegex.test(sanctionRaw)) {
      const [, nombre, uniteLetter] = sanctionRaw.match(durRegex);
      let unite;
      if (uniteLetter.toUpperCase() === "J") unite = "jour(s)";
      else if (uniteLetter.toUpperCase() === "M") unite = "mois";
      else unite = "an(s)";
      duration = `${nombre} ${unite}`;
    } else if (/^(perm|permanent)$/i.test(sanctionRaw)) {
      duration = "Permanent";
    } else {
      return;
    }

    const dateApplication = message.createdAt;

    await db.execute(
      `INSERT INTO sanctions (guild_id, punisher_id, pseudo, raison, duration, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        message.guild.id,
        message.author.id,
        pseudo,
        raison,
        duration,
        dateApplication,
      ]
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
        },
        {
          name: "Date appliquée",
          value: `<t:${Math.floor(dateApplication.getTime() / 1000)}:F>`,
          inline: true,
        }
      )
      .setColor(0xff0000)
      .setTimestamp();

    const embedChannel = await message.guild.channels.fetch(
      config.embed_channel_id
    );
    if (embedChannel) embedChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Erreur lors du traitement des sanctions :", err);
  } // --- FIN LOGIQUE SANCTIONS ---
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

      if (!interaction.alreadyLogged) {
        const { logCommandUsage } = require("./tasks/logSystem");
        await logCommandUsage(client, interaction, {
          affected: interaction.channel ? interaction.channel.name : "MP",
        });
        interaction.alreadyLogged = true;
      }
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Une erreur est survenue.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Une erreur est survenue.",
          ephemeral: true,
        });
      }
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
            ephemeral: true,
          });
        }
        const robloxId = response.data.Id;
        await db
          .promise()
          .execute(
            `INSERT INTO user_roblox (discord_id, roblox_username, roblox_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE roblox_username = VALUES(roblox_username), roblox_id = VALUES(roblox_id)`,
            [discordId, username, robloxId]
          );
        await interaction.reply({
          content: `Ton compte Roblox **${username}** (ID: ${robloxId}) a été associé à ton compte Discord !`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Erreur lors de la connexion du compte Roblox :", error);
        await interaction.reply({
          content:
            "Erreur lors de la connexion du compte Roblox. Réessayez plus tard.",
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isButton()) {
    const buttonHandler = require("./interactionCreate");
    buttonHandler(interaction);
  } else if (!interaction.isCommand()) return;

  const commandName = interaction.commandName;
  const guildId = interaction.guild?.id || "dm";

  try {
    const commandName = interaction.commandName;
    const guildId = interaction.guild?.id || "dm";

    if (commandName && guildId) {
      await db.execute(
        "INSERT INTO commands_logs (guild_id, command_name) VALUES (?, ?)",
        [guildId, commandName]
      );
    }
  } catch (logError) {
    console.error(
      "Erreur non-critique lors du logging de la commande :",
      logError.sqlMessage || logError.message
    );
  }
});

(async () => {
  await initDatabase();
  client.login(process.env.TOKEN);
})();