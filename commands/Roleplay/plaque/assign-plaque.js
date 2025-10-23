const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const db = require("../../../db"); // J'ai gardé ton chemin ../../../db

module.exports = {
  data: new SlashCommandBuilder()
    .setName("assign-plaque")
    .setDescription("Assigner une plaque d'immatriculation à un utilisateur")
    .addStringOption((opt) =>
      opt
        .setName("prenom")
        .setDescription("Prénom du propriétaire")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("nom")
        .setDescription("Nom du propriétaire (nom RP)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("plaque")
        .setDescription("Plaque à assigner")
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName("utilisateur")
        .setDescription("Utilisateur Discord (optionnel)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const ROLE_ID_FIC = "1379059899828404295";

    const hasAdminPerm = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    const hasRole = interaction.member.roles.cache.has(ROLE_ID_FIC);

    if (!hasAdminPerm && !hasRole) {
      return interaction.reply({
        content:
          "❌ Tu n'as pas la permission **Administrateur** ou le rôle requis pour utiliser cette commande.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");
    const prenom = interaction.options.getString("prenom");
    const nom = interaction.options.getString("nom");
    const plaque = interaction.options.getString("plaque").toUpperCase();
    const guildId = interaction.guild.id;

    const userId = user ? user.id : null;

    const [[existing]] = await db.execute(
      `SELECT * FROM plaque_registry WHERE plaque = ?`,
      [plaque]
    );

    if (existing) {
      return interaction.reply({
        content: "❌ Cette plaque est déjà assignée à quelqu'un.",
        ephemeral: true,
      });
    }
    await db.execute(
      `INSERT INTO plaque_registry (plaque, user_id, prenom, nom, guild_id) VALUES (?, ?, ?, ?, ?)`,
      [plaque, userId, prenom, nom.toUpperCase(), guildId]
    );

    return interaction.reply({
      content: `✅ La plaque \`${plaque}\` a été assignée à **${prenom} ${nom.toUpperCase()}**.`,
    });
  },
};