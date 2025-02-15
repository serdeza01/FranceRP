const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const STAFF_ROLE_ID = '1304151263851708458';
const CHANNEL_ID = '1337086501778882580';

const staffUsernames = [];

const staffStatus = new Map();
let lastMessageId = null;

client.once('ready', async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.first();
    if (!guild) return console.log("Le bot n'est dans aucun serveur.");

    const members = await guild.members.fetch();
    
    for (const username of staffUsernames) {
      const member = members.find(m => m.user.username === username);
      if (member && member.roles.cache.has(STAFF_ROLE_ID)) {
        staffStatus.set(member.id, 'disponible');
      }
    }

    await updatePresenceEmbed();
  } catch (error) {
    console.error("Erreur lors de la récupération des membres :", error);
  }
});

async function updatePresenceEmbed() {
  try {
    const availableStaff = [];
    
    const channel = await client.channels.fetch(CHANNEL_ID);
    const guild = channel.guild; // Récupération du serveur à partir du salon

    for (const [userId, status] of staffStatus) {
      if (status === 'disponible') {
        try {
          const member = await client.users.fetch(userId);
          const guildMember = await guild.members.fetch(member.id); // Récupération du pseudo d'affichage
          availableStaff.push(`- ${guildMember.displayName}`);
        } catch (error) {
          console.warn(`Impossible de récupérer le membre ${userId}`);
        }
      }
    }

    const file = new AttachmentBuilder("./image.png");

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Statut des Staffs disponible en jeu')
      .setTimestamp()
      .setThumbnail('attachment://image.png')
      .addFields({ name: `Disponibles`, value: availableStaff.join('\n') || 'Aucun', inline: false });

    if (lastMessageId) {
      const lastMessage = await channel.messages.fetch(lastMessageId).catch(() => null);
      if (lastMessage) await lastMessage.delete();
    }

    const newMessage = await channel.send({ embeds: [embed], files: [file] });
    lastMessageId = newMessage.id;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'embed :", error);
  }
}

client.on('ready', async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  await guild.commands.create(
    new SlashCommandBuilder()
      .setName('presence')
      .setDescription('Signaler sa disponibilité en tant que staff.')
      .addStringOption((option) =>
        option
          .setName('statut')
          .setDescription('Choisissez votre statut')
          .setRequired(true)
          .addChoices(
            { name: 'Disponible', value: 'disponible' },
            { name: 'Indisponible', value: 'indisponible' }
          )
      )
  );
  console.log("Commande /presence enregistrée !");
});

// Connecte le bot à Discord
client.login(process.env.TOKEN);