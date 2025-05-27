const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db');
const { createPagination } = require('../../tasks/pagination');
const { syncUser } = require('../../tasks/users-backup-commands');

const OWNER_ID = '637760775691173888';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner-backup-list')
        .setDescription('Statistiques globales sur les sauvegardes.')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription("Afficher les sauvegardes d'un utilisateur spécifique")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('guild')
                .setDescription("Afficher les sauvegardes d'un serveur spécifique (ID)")
                .setRequired(false)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ Cette commande est réservée au propriétaire.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        await syncUser(interaction);

        const userOption = interaction.options.getUser('user');
        const guildIdOption = interaction.options.getString('guild');

        if (userOption) {
            const userId = userOption.id;

            const [backups] = await db.execute(`
                SELECT b.name, b.created_at, b.guild_id, b.guild_name, u.username
                FROM backups b
                LEFT JOIN users u ON b.user_id = u.user_id
                WHERE b.user_id = ?
                ORDER BY b.created_at DESC
            `, [userId]);

            const [restores] = await db.execute(`
                SELECT br.created_at, br.guild_id, br.user_id, b.name, b.guild_name
                FROM backup_restores br
                LEFT JOIN backups b ON br.backup_id = b.id
                WHERE br.user_id = ?
                ORDER BY br.created_at DESC
            `, [userId]);

            const pages = createPagination(backups.map(b => `📦 **${b.name}** | 🕒 ${new Date(b.created_at).toLocaleString()} | 🌐 ${b.guild_name || 'Inconnu'} (ID: ${b.guild_id})`), 25);
            const restorePages = createPagination(restores.map(r => `♻️ **${r.name}** restaurée sur 🌐 ${r.guild_name || 'Inconnu'} (ID: ${r.guild_id}) le 🕒 ${new Date(r.created_at).toLocaleString()}`), 25);

            return interaction.editReply({
                content: `### 📊 Statistiques pour l'utilisateur <@${userId}>
- 📦 Sauvegardes créées : **${backups.length}**
- ♻️ Sauvegardes restaurées : **${restores.length}**

__📦 Détail des sauvegardes :__
${pages[0] || 'Aucune sauvegarde.'}

__♻️ Détail des restaurations :__
${restorePages[0] || 'Aucune restauration.'}`
            });
        }

        if (guildIdOption) {
            const [backups] = await db.execute(`
                SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC
            `, [guildIdOption]);

            const [restores] = await db.execute(`
                SELECT br.*, b.name, b.guild_name FROM backup_restores br
                LEFT JOIN backups b ON br.backup_id = b.id
                WHERE br.guild_id = ?
                ORDER BY br.created_at DESC
            `, [guildIdOption]);

            const serverName = backups[0]?.guild_name || restores[0]?.guild_name || 'Inconnu';

            const pages = createPagination(backups.map(b => `📦 **${b.name}** par <@${b.user_id}> | 🕒 ${new Date(b.created_at).toLocaleString()}`), 25);
            const restorePages = createPagination(restores.map(r => `♻️ **${r.name}** par <@${r.user_id}> le 🕒 ${new Date(r.created_at).toLocaleString()}`), 25);

            return interaction.editReply({
                content: `### 📊 Statistiques pour le serveur **${serverName}** (ID: ${guildIdOption})
- 📦 Sauvegardes créées : **${backups.length}**
- ♻️ Sauvegardes restaurées : **${restores.length}**

__📦 Détail des sauvegardes :__
${pages[0] || 'Aucune sauvegarde.'}

__♻️ Détail des restaurations :__
${restorePages[0] || 'Aucune restauration.'}`
            });
        }

        const [[{ total }]] = await db.execute('SELECT COUNT(*) AS total FROM backups');

        const [byGuild] = await db.execute(`
            SELECT guild_id, guild_name, COUNT(*) AS count FROM backups GROUP BY guild_id ORDER BY count DESC
        `);

        const [[{ totalRestored }]] = await db.execute('SELECT COUNT(*) AS totalRestored FROM backup_restores');

        const guildStats = byGuild.map(g => `🌐 **${g.guild_name || 'Inconnu'}** (ID: ${g.guild_id}) : 📦 ${g.count}`).join('\n');

        return interaction.editReply({
            content: `### 📊 Statistiques globales
- 📦 Sauvegardes totales : **${total}**
- ♻️ Sauvegardes restaurées : **${totalRestored}**

__📦 Sauvegardes par serveur :__
${guildStats}`
        });
    }
};
