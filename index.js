const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  AttachmentBuilder, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import de la fonction sendTicketPanel
const { sendTicketPanel } = require('./ticketPanel');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Configuration des commandes dans une Collection
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Variables globales pour la gestion de la présence
global.staffStatus = new Map(); // Map { userId => 'disponible' / autre }
global.lastMessageId = null;
const STAFF_ROLE_ID = '1304151263851708458';
const CHANNEL_ID = '1337086501778882580';
// Si tu souhaites charger des statuts initiaux par pseudo, ajoute-les ici
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
      if (status === 'disponible') {
        try {
          // Récupère le pseudo d'affichage dans le serveur
          const member = await client.users.fetch(userId);
          const guildMember = await guild.members.fetch(member.id);
          availableStaff.push(`- ${guildMember.displayName}`);
        } catch (error) {
          console.warn(`Impossible de récupérer le membre ${userId}`);
        }
      }
    }
    // Création de la pièce jointe pour le thumbnail
    const file = new AttachmentBuilder("./image.png");
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Statut des Staffs disponibles en jeu')
      .setTimestamp()
      .setThumbnail('attachment://image.png')
      .addFields({ name: 'Disponibles', value: availableStaff.join('\n') || 'Aucun', inline: false });
    
    // Supprime l'ancien embed s'il existe
    if (global.lastMessageId) {
      const lastMessage = await channel.messages.fetch(global.lastMessageId).catch(() => null);
      if (lastMessage) await lastMessage.delete();
    }
    
    const newMessage = await channel.send({ embeds: [embed], files: [file] });
    global.lastMessageId = newMessage.id;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'embed :", error);
  }
}

client.once('ready', async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("Le bot n'est dans aucun serveur.");
    return;
  }

  // Enregistrement de toutes les commandes dans le serveur
  try {
    await guild.commands.set(client.commands.map(command => command.data));
    console.log("Commandes enregistrées !");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes :", error);
  }

  // Chargement initial des statuts à partir de staffUsernames (si définis)
  try {
    const members = await guild.members.fetch();
    for (const username of staffUsernames) {
      const member = members.find(m => m.user.username === username);
      if (member && member.roles.cache.has(STAFF_ROLE_ID)) {
        global.staffStatus.set(member.id, 'disponible');
      }
    }
    await updatePresenceEmbed(guild, CHANNEL_ID);
  } catch (error) {
    console.error("Erreur lors de la récupération des membres :", error);
  }

  // Envoi automatique du panneau de ticket dans le salon d'ID 1304151485264822292
  await sendTicketPanel(client);
});

// Gestion dynamique des interactions (commandes)
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, { staffStatus: global.staffStatus, updatePresenceEmbed, CHANNEL_ID, STAFF_ROLE_ID });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
    }
  } else if (interaction.isButton()) {
    // Appel du handler pour les boutons
    const buttonHandler = require('./interactionCreate');
    buttonHandler(interaction);
  }
});

// Connexion du bot
client.login(process.env.TOKEN);
