const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Liste toutes les commandes disponibles"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("Commandes Disponibles")
      .setDescription(`
**Les commandes de jeu :**

**/pendu** - Lance une partie de pendu
**/guess** - Devinez un nombre aléatoire défini par le joueur
**/snake** - Joue au jeu du Snake
**/math** - Série de calcul mental

**Les commandes de niveau :**

**/leaderboard** - Affiche le classement des niveaux
**/niveau [user]** - Affiche le niveau de l'utilisateur spécifié ou le vôtre
**/setup-level** - Configure le système de niveaux

**Les commandes de modération :**

**/historique [user]** - Affiche l'historique des sanctions d'un utilisateur
**/mod ban [user] [reason] [duration]** - Ban un utilisateur
**/mod unban [userId] [reason]** - Unban un utilisateur
**/mod kick [user] [reason]** - Kick un utilisateur
**/mod timeout [user] [reason] [duration]** - Timeout un utilisateur
**/mod warn [user] [reason]** - Donne un avertissement à un utilisateur
**/mod clear [amount]** - Supprime un nombre de message précisé
**/mod blacklist [user] [reason] [duration]** - Blacklist un utilisateur (similaire au /mod ban) mais récupère des informations
**/sanction eh [pseudo]** - Permet de trouver l'historique de sanction d'un joueur roblox

**Les commandes de setup :**

**/setup-ticket** - Setup le système de ticket
**/setup-reaction** - Setup le système de réaction automatique dans un channel
**/setup-permis** - Setup le système de permis
**/setup-assurance** - Setup le système d'assurance
**/setup-presence** - Setup le système de la présence des staff en jeu
**/delete-config** - Supprime la configuration actuel des tickets
**/setup-antispam** - Setup le système d'antispam
**/setup-sanctioneh** - Setup le système de sanction

**Les autres commandes :**

**/add_role [role]** - Ajoute l'accès à un role dans le ticket
**/remove_role [role]** - Supprime l'accès d'un role dans un ticket
**/add_user [user]** - Ajoute l'accès au ticket à un utilisateur
**/remove_user [user]** - Supprime l'accès au ticket à un utilisateur
**/ajouter-assurance** - Ajoute l'assurance d'un utilisateur
**/supprimer-assurance** - Supprime l'assurance de l'utilisateur
**/assurance** - Affiche son assurance
**/ajouter-permis** - Ajoute le permis d'un utilisateur
**/suppirmer-permis** - Supprime le permis de l'utilisateur
**/permis** - Affiche son permis
**/presence** - Permet d'afficher sa disponibilité en tant que staff
**/rename** - Permet de renommer un ticket
**/giveaway** - Permet de créer un giveaway
**/link [guildId]** - Permet de relier 2 serveur pour partager l'historique des sanctions
      `)
      .setColor("#00ff00")
      .setFooter({ text: "Made by serdeza" })
    return interaction.reply({ embeds: [embed] });
  },
};
