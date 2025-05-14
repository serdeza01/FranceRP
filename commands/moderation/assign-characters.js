const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");
const getLinkedGuildIds = require("../../getLinkedGuildIds");

const ALLOWED_ROLES = [
    "1313029840328327248",
    "1304151263851708458",
    "962270129511604224",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("assign-characters")
        .setDescription("Attribuer deux personnages à un utilisateur (propagé sur les serveurs liés)")
        .setDefaultMemberPermissions(0)
        .setDMPermission(false)
        .addUserOption(o => o.setName("user").setDescription("Utilisateur cible").setRequired(true))
        .addStringOption(o => o.setName("name1").setDescription("Nom personnage 1").setRequired(true))
        .addStringOption(o => o.setName("name2").setDescription("Nom personnage 2").setRequired(true))
        .addStringOption(o => o.setName("job1_1").setDescription("Métier 1 du perso 1"))
        .addStringOption(o => o.setName("job1_2").setDescription("Métier 2 du perso 1"))
        .addStringOption(o => o.setName("job2_1").setDescription("Métier 1 du perso 2"))
        .addStringOption(o => o.setName("job2_2").setDescription("Métier 2 du perso 2")),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id))) {
            return interaction.reply({ content: "❌ pas les bons rôles.", ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const guildIds = await getLinkedGuildIds(db, guildId);
        const user = interaction.options.getUser("user");
        const name1 = interaction.options.getString("name1");
        const name2 = interaction.options.getString("name2");
        const job1_1 = interaction.options.getString("job1_1");
        const job1_2 = interaction.options.getString("job1_2");
        const job2_1 = interaction.options.getString("job2_1");
        const job2_2 = interaction.options.getString("job2_2");

        const delPlaceholders = guildIds.map(() => "?").join(",");
        await db.execute(
            `DELETE FROM characters
       WHERE guild_id IN (${delPlaceholders}) AND user_id = ?`,
            [...guildIds, user.id]
        );

        const sql = `INSERT INTO characters
      (guild_id,user_id,slot,name,job1,job2)
      VALUES (?,?,?,?,?,?)`;
        for (const gid of guildIds) {
            await db.execute(sql, [gid, user.id, 1, name1, job1_1, job1_2]);
            await db.execute(sql, [gid, user.id, 2, name2, job2_1, job2_2]);
        }

        return interaction.reply({
            content: `✅ ${user.tag} a bien deux personnages enregistrés sur ${guildIds.length} serveur(s).`,
        });
    },
};
